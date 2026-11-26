begin;

create function public.payment_process_due_agreements(
  p_agreement uuid default null,
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.payment_agreement_rooms%rowtype;
  v_state jsonb;
  v_deadline timestamptz;
  v_amount numeric;
  v_releases jsonb;
  v_ledger jsonb;
  v_changed boolean;
  v_processed integer := 0;
begin
  for v_room in
    select *
    from public.payment_agreement_rooms
    where (p_agreement is null or agreement_id = p_agreement)
      and state #>> '{room,timelineVersion}' = '2'
      and (
        (
          state #>> '{room,progressReview,status}' = 'PENDING'
          and state #>> '{room,project}' = 'AWAITING_PROGRESS_REVIEW'
        )
        or (
          state #>> '{room,handover,status}' = 'AWAITING_CLIENT'
          and state #>> '{room,project}' = 'AWAITING_RESULT_ACCEPTANCE'
        )
      )
      and coalesce(state #>> '{room,dispute,status}', '') <> 'NEEDS_REVIEW'
    for update
  loop
    v_state := v_room.state;
    v_changed := false;

    if v_state #>> '{room,progressReview,status}' = 'PENDING'
      and v_state #>> '{room,project}' = 'AWAITING_PROGRESS_REVIEW'
      and coalesce(v_state #>> '{room,dispute,status}', '') <> 'NEEDS_REVIEW'
    then
      v_deadline := nullif(v_state #>> '{room,progressReview,deadlineAt}', '')::timestamptz;
      if v_deadline is not null and v_deadline <= p_now then
        v_amount := (v_state #>> '{room,proposal,dp}')::numeric;
        v_releases := coalesce(v_state #> '{room,releases}', '[]'::jsonb);
        v_ledger := coalesce(v_state -> 'ledger', '[]'::jsonb);
        if not exists (
          select 1 from jsonb_array_elements(v_releases) release
          where release ->> 'kind' = 'DP'
        ) then
          v_releases := v_releases || jsonb_build_array(jsonb_build_object(
            'kind', 'DP', 'amount', v_amount, 'at', v_deadline
          ));
          v_ledger := v_ledger || jsonb_build_array(jsonb_build_object(
            'entry', 'DP_RELEASED', 'amount', v_amount, 'order_id', null, 'recorded_at', v_deadline
          ));
        end if;
        v_state := jsonb_set(v_state, '{room,progressReview,status}', '"AUTO_APPROVED"'::jsonb, true);
        v_state := jsonb_set(v_state, '{room,progressReview,approvedAt}', to_jsonb(v_deadline), true);
        v_state := jsonb_set(v_state, '{room,progressReview,autoApproved}', 'true'::jsonb, true);
        v_state := jsonb_set(v_state, '{room,project}', '"IN_PROGRESS"'::jsonb, true);
        v_state := jsonb_set(v_state, '{room,escrow}', '"DP_RELEASED"'::jsonb, true);
        v_state := jsonb_set(v_state, '{room,timeline,progressApprovedAt}', to_jsonb(v_deadline), true);
        v_state := jsonb_set(v_state, '{room,timeline,dpReleasedAt}', to_jsonb(v_deadline), true);
        v_state := jsonb_set(v_state, '{room,releases}', v_releases, true);
        v_state := jsonb_set(v_state, '{ledger}', v_ledger, true);
        v_changed := true;
      end if;
    end if;

    if v_state #>> '{room,handover,status}' = 'AWAITING_CLIENT'
      and v_state #>> '{room,project}' = 'AWAITING_RESULT_ACCEPTANCE'
      and coalesce(v_state #>> '{room,dispute,status}', '') <> 'NEEDS_REVIEW'
    then
      v_deadline := nullif(v_state #>> '{room,handover,deadlineAt}', '')::timestamptz;
      if v_deadline is not null and v_deadline <= p_now then
        v_amount := (v_state #>> '{room,proposal,remaining}')::numeric;
        v_releases := coalesce(v_state #> '{room,releases}', '[]'::jsonb);
        v_ledger := coalesce(v_state -> 'ledger', '[]'::jsonb);
        if not exists (
          select 1 from jsonb_array_elements(v_releases) release
          where release ->> 'kind' = 'REMAINING'
        ) then
          v_releases := v_releases || jsonb_build_array(jsonb_build_object(
            'kind', 'REMAINING', 'amount', v_amount, 'at', v_deadline
          ));
          v_ledger := v_ledger || jsonb_build_array(jsonb_build_object(
            'entry', 'REMAINING_RELEASED', 'amount', v_amount, 'order_id', null, 'recorded_at', v_deadline
          ));
        end if;
        v_state := jsonb_set(v_state, '{room,handover,status}', '"AUTO_ACCEPTED"'::jsonb, true);
        v_state := jsonb_set(v_state, '{room,result}', jsonb_build_object(
          'acceptedAt', v_deadline, 'autoAcceptedAt', v_deadline
        ), true);
        v_state := jsonb_set(v_state, '{room,project}', '"COMPLETED"'::jsonb, true);
        v_state := jsonb_set(v_state, '{room,escrow}', '"RELEASED"'::jsonb, true);
        v_state := jsonb_set(v_state, '{room,timeline,resultAcceptedAt}', to_jsonb(v_deadline), true);
        v_state := jsonb_set(v_state, '{room,timeline,autoAcceptedAt}', to_jsonb(v_deadline), true);
        v_state := jsonb_set(v_state, '{room,releases}', v_releases, true);
        v_state := jsonb_set(v_state, '{ledger}', v_ledger, true);
        v_changed := true;
      end if;
    end if;

    if v_changed then
      update public.payment_agreement_rooms
        set state = v_state, version = version + 1
        where agreement_id = v_room.agreement_id;
      v_processed := v_processed + 1;
    end if;
  end loop;
  return v_processed;
end;
$$;

revoke all on function public.payment_process_due_agreements(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.payment_process_due_agreements(uuid, timestamptz) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
  if to_regclass('cron.job') is not null then
    execute 'select cron.schedule($1, $2, $3)'
      using 'devmatch-payment-agreement-deadlines', '* * * * *',
        'select public.payment_process_due_agreements(null, now())';
  end if;
end;
$$;

commit;
