begin;

create table public.agreement_reviews (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid references public.project_agreements(id) on delete cascade,
  engagement_id uuid references public.project_engagements(id) on delete set null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  reviewer_role text not null check (reviewer_role in ('client', 'developer')),
  reviewee_role text not null check (reviewee_role in ('client', 'developer')),
  direction text not null check (direction in ('client_to_developer', 'developer_to_client')),
  quality_of_work smallint,
  communication smallint,
  meeting_deadline smallint,
  clarity_of_brief smallint,
  responsiveness smallint,
  respecting_scope smallint,
  legacy_rating smallint,
  comment text not null default '',
  status text not null default 'hidden' check (status in ('hidden', 'published', 'removed')),
  source text not null check (source in ('agreement', 'legacy')),
  reviewer_name text not null,
  reviewer_initials text not null,
  project_title text not null,
  delivery_badge text,
  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (reviewer_id <> reviewee_id),
  check ((reviewer_role = 'client' and reviewee_role = 'developer'
      and direction = 'client_to_developer')
    or (reviewer_role = 'developer' and reviewee_role = 'client'
      and direction = 'developer_to_client')),
  check (
    (source = 'agreement' and agreement_id is not null and engagement_id is null
      and quality_of_work between 1 and 5 and communication between 1 and 5
      and meeting_deadline between 1 and 5 and clarity_of_brief between 1 and 5
      and responsiveness between 1 and 5 and respecting_scope between 1 and 5
      and legacy_rating is null
      and char_length(comment) <= 500)
    or (source = 'legacy' and (engagement_id is not null or agreement_id is not null)
      and quality_of_work is null and communication is null and meeting_deadline is null
      and clarity_of_brief is null and responsiveness is null and respecting_scope is null
      and legacy_rating between 1 and 5
      and char_length(comment) <= 2000)
  ),
  check ((status = 'published') = (published_at is not null))
);

create unique index agreement_reviews_one_per_direction_idx
  on public.agreement_reviews (agreement_id, reviewer_id, direction)
  where agreement_id is not null;
create unique index agreement_reviews_legacy_once_idx
  on public.agreement_reviews (engagement_id, reviewer_id, direction)
  where source = 'legacy';
create index agreement_reviews_public_profile_idx
  on public.agreement_reviews (reviewee_id, reviewee_role, published_at desc)
  where status = 'published';

alter table public.agreement_reviews enable row level security;
revoke all on public.agreement_reviews from public, anon, authenticated;

create table public.agreement_rating_aggregates (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_role text not null check (profile_role in ('client', 'developer')),
  review_count integer not null default 0,
  overall_score_units bigint not null default 0,
  quality_of_work_sum bigint not null default 0,
  communication_sum bigint not null default 0,
  meeting_deadline_sum bigint not null default 0,
  clarity_of_brief_sum bigint not null default 0,
  responsiveness_sum bigint not null default 0,
  respecting_scope_sum bigint not null default 0,
  criteria_review_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, profile_role)
);

alter table public.agreement_rating_aggregates enable row level security;
revoke all on public.agreement_rating_aggregates from public, anon, authenticated;

create function public.update_agreement_rating_aggregate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_weight integer := 0;
  v_new_weight integer := 0;
  v_user_id uuid;
  v_profile_role text;
  v_overall_units integer;
begin
  if tg_op <> 'INSERT' and old.status = 'published' then v_old_weight := 1; end if;
  if tg_op <> 'DELETE' and new.status = 'published' then v_new_weight := 1; end if;

  if tg_op <> 'INSERT' and v_old_weight = 1 then
    v_user_id := old.reviewee_id;
    v_profile_role := old.reviewee_role;
    v_overall_units := case when old.source = 'legacy' then
      old.legacy_rating * 3
      when old.reviewer_role = 'client' then old.quality_of_work + old.communication + old.meeting_deadline
      else old.clarity_of_brief + old.responsiveness + old.respecting_scope
    end;
    insert into public.agreement_rating_aggregates (
      user_id, profile_role, review_count, overall_score_units,
      quality_of_work_sum, communication_sum, meeting_deadline_sum,
      clarity_of_brief_sum, responsiveness_sum, respecting_scope_sum,
      criteria_review_count
    ) values (
      v_user_id, v_profile_role, -1, -v_overall_units,
      -coalesce(old.quality_of_work, 0), -coalesce(old.communication, 0),
      -coalesce(old.meeting_deadline, 0), -coalesce(old.clarity_of_brief, 0),
      -coalesce(old.responsiveness, 0), -coalesce(old.respecting_scope, 0),
      case when old.source = 'agreement' then -1 else 0 end
    )
    on conflict (user_id, profile_role) do update set
      review_count = agreement_rating_aggregates.review_count + excluded.review_count,
      overall_score_units = agreement_rating_aggregates.overall_score_units + excluded.overall_score_units,
      quality_of_work_sum = agreement_rating_aggregates.quality_of_work_sum + excluded.quality_of_work_sum,
      communication_sum = agreement_rating_aggregates.communication_sum + excluded.communication_sum,
      meeting_deadline_sum = agreement_rating_aggregates.meeting_deadline_sum + excluded.meeting_deadline_sum,
      clarity_of_brief_sum = agreement_rating_aggregates.clarity_of_brief_sum + excluded.clarity_of_brief_sum,
      responsiveness_sum = agreement_rating_aggregates.responsiveness_sum + excluded.responsiveness_sum,
      respecting_scope_sum = agreement_rating_aggregates.respecting_scope_sum + excluded.respecting_scope_sum,
      criteria_review_count = agreement_rating_aggregates.criteria_review_count + excluded.criteria_review_count,
      updated_at = now();
  end if;

  if tg_op <> 'DELETE' and v_new_weight = 1 then
    v_overall_units := case when new.source = 'legacy' then
      new.legacy_rating * 3
      when new.reviewer_role = 'client' then new.quality_of_work + new.communication + new.meeting_deadline
      else new.clarity_of_brief + new.responsiveness + new.respecting_scope
    end;
    insert into public.agreement_rating_aggregates (
      user_id, profile_role, review_count, overall_score_units,
      quality_of_work_sum, communication_sum, meeting_deadline_sum,
      clarity_of_brief_sum, responsiveness_sum, respecting_scope_sum,
      criteria_review_count
    ) values (
      new.reviewee_id, new.reviewee_role, 1, v_overall_units,
      coalesce(new.quality_of_work, 0), coalesce(new.communication, 0),
      coalesce(new.meeting_deadline, 0), coalesce(new.clarity_of_brief, 0),
      coalesce(new.responsiveness, 0), coalesce(new.respecting_scope, 0),
      case when new.source = 'agreement' then 1 else 0 end
    )
    on conflict (user_id, profile_role) do update set
      review_count = agreement_rating_aggregates.review_count + excluded.review_count,
      overall_score_units = agreement_rating_aggregates.overall_score_units + excluded.overall_score_units,
      quality_of_work_sum = agreement_rating_aggregates.quality_of_work_sum + excluded.quality_of_work_sum,
      communication_sum = agreement_rating_aggregates.communication_sum + excluded.communication_sum,
      meeting_deadline_sum = agreement_rating_aggregates.meeting_deadline_sum + excluded.meeting_deadline_sum,
      clarity_of_brief_sum = agreement_rating_aggregates.clarity_of_brief_sum + excluded.clarity_of_brief_sum,
      responsiveness_sum = agreement_rating_aggregates.responsiveness_sum + excluded.responsiveness_sum,
      respecting_scope_sum = agreement_rating_aggregates.respecting_scope_sum + excluded.respecting_scope_sum,
      criteria_review_count = agreement_rating_aggregates.criteria_review_count + excluded.criteria_review_count,
      updated_at = now();
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger agreement_reviews_update_aggregate
after insert or update of status or delete on public.agreement_reviews
for each row execute function public.update_agreement_rating_aggregate();

create table public.agreement_review_replies (
  review_id uuid primary key references public.agreement_reviews(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  comment text not null check (char_length(comment) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.agreement_review_replies enable row level security;
revoke all on public.agreement_review_replies from public, anon, authenticated;

create table public.agreement_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.agreement_reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);
alter table public.agreement_review_reports enable row level security;
revoke all on public.agreement_review_reports from public, anon, authenticated;

create table public.agreement_review_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.agreement_review_moderators enable row level security;
revoke all on public.agreement_review_moderators from public, anon, authenticated;
grant select, insert, delete on public.agreement_review_moderators to service_role;

create table public.agreement_review_windows (
  agreement_id uuid primary key references public.project_agreements(id) on delete cascade,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  reminder_sent_at timestamptz,
  check (closes_at = opens_at + interval '14 days')
);
alter table public.agreement_review_windows enable row level security;
revoke all on public.agreement_review_windows from public, anon, authenticated;

create table public.agreement_review_notification_events (
  agreement_id uuid not null references public.project_agreements(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('opened', 'reminder', 'published')),
  created_at timestamptz not null default now(),
  primary key (agreement_id, recipient_id, event)
);
alter table public.agreement_review_notification_events enable row level security;
revoke all on public.agreement_review_notification_events from public, anon, authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'reply', 'favorite', 'message', 'payment',
    'rating', 'rating_opened', 'rating_reminder'));

create function public.insert_agreement_rating_notification(
  p_agreement_id uuid,
  p_recipient_id uuid,
  p_actor_id uuid,
  p_event text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_kind text;
begin
  v_kind := case p_event
    when 'opened' then 'rating_opened'
    when 'reminder' then 'rating_reminder'
    when 'published' then 'rating'
  end;
  if v_kind is null then raise exception 'Invalid rating notification event'; end if;
  insert into public.agreement_review_notification_events (agreement_id, recipient_id, event)
  values (p_agreement_id, p_recipient_id, p_event)
  on conflict do nothing;
  if not found then return; end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_recipient_id
      and p.profile_data->'notificationPreferences'->>'ratings' = 'false'
  ) then return; end if;

  select conversation_id into v_conversation_id
  from public.project_agreements where id = p_agreement_id;
  insert into public.notifications (recipient_id, actor_id, kind, conversation_id)
  values (p_recipient_id, p_actor_id, v_kind, v_conversation_id);
end;
$$;

create function public.agreement_review_window_eligible(
  p_agreement_id uuid,
  p_state jsonb
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_state #>> '{room,timelineVersion}' = '2'
    and p_state #>> '{room,project}' in ('COMPLETED', 'DISPUTE_RESOLVED')
    and p_state #>> '{room,escrow}' = 'RELEASED'
    and p_state #>> '{room,dispute,status}' is distinct from 'NEEDS_REVIEW'
    and (
      nullif(p_state #>> '{room,result,acceptedAt}', '') is not null
      or (
        p_state #>> '{room,project}' = 'DISPUTE_RESOLVED'
        and p_state #>> '{room,dispute,status}' = 'RESOLVED'
        and nullif(p_state #>> '{room,dispute,resolvedAt}', '') is not null
      )
    )
    and (
      p_state #>> '{room,dispute,status}' is distinct from 'RESOLVED'
      or nullif(p_state #>> '{room,dispute,resolvedAt}', '') is not null
    )
    and exists (
      select 1 from public.payments dp
      where dp.agreement_id = p_agreement_id and dp.kind = 'dp' and dp.status = 'paid'
    )
    and exists (
      select 1 from public.payments remaining
      where remaining.agreement_id = p_agreement_id and remaining.kind = 'remaining'
        and remaining.status = 'paid'
    );
$$;

create function public.sync_agreement_review_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_agreement public.project_agreements%rowtype;
begin
  if not public.agreement_review_window_eligible(new.agreement_id, new.state) then
    return new;
  end if;

  select * into v_agreement from public.project_agreements where id = new.agreement_id;
  v_start := greatest(
    coalesce(nullif(new.state #>> '{room,result,acceptedAt}', '')::timestamptz,
      nullif(new.state #>> '{room,dispute,resolvedAt}', '')::timestamptz),
    coalesce(nullif(new.state #>> '{room,dispute,resolvedAt}', '')::timestamptz,
      nullif(new.state #>> '{room,result,acceptedAt}', '')::timestamptz)
  );
  insert into public.agreement_review_windows (agreement_id, opens_at, closes_at)
  values (new.agreement_id, v_start, v_start + interval '14 days')
  on conflict (agreement_id) do update set
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at
  where agreement_review_windows.opens_at is distinct from excluded.opens_at;

  if tg_op = 'INSERT'
    or old.state #>> '{room,project}' not in ('COMPLETED', 'DISPUTE_RESOLVED')
  then
    perform public.insert_agreement_rating_notification(
      new.agreement_id, v_agreement.client_id, v_agreement.developer_id, 'opened');
    perform public.insert_agreement_rating_notification(
      new.agreement_id, v_agreement.developer_id, v_agreement.client_id, 'opened');
  end if;
  return new;
end;
$$;

create trigger payment_agreement_rating_window
after insert or update of state on public.payment_agreement_rooms
for each row execute function public.sync_agreement_review_window();

create function public.publish_agreement_review_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'agreement' and new.status = 'published'
    and (tg_op = 'INSERT' or old.status <> 'published') then
    perform public.insert_agreement_rating_notification(
      new.agreement_id, new.reviewer_id, new.reviewee_id, 'published');
    perform public.insert_agreement_rating_notification(
      new.agreement_id, new.reviewee_id, new.reviewer_id, 'published');
  end if;
  return new;
end;
$$;

create trigger agreement_review_published_notification
after insert or update of status on public.agreement_reviews
for each row execute function public.publish_agreement_review_notification();

insert into public.agreement_reviews (
  id, engagement_id, reviewer_id, reviewee_id, agreement_id, reviewer_role, reviewee_role, direction,
  comment, status, source, reviewer_name, reviewer_initials, project_title,
  legacy_rating, submitted_at, published_at, created_at
)
select
  r.id, r.engagement_id, r.reviewer_id, r.reviewed_user_id,
  (
    select a.id from public.project_agreements a
    join public.payment_agreement_rooms room on room.agreement_id = a.id
    where a.conversation_id = e.conversation_id
      and a.payment_status = 'paid'
      and public.agreement_review_window_eligible(a.id, room.state)
      and a.created_at <= r.created_at
    order by a.created_at desc
    limit 1
  ),
  -- The agreement link keeps a legacy review from being counted again for the same project.
  case when r.reviewer_id = e.client_id then 'client' else 'developer' end,
  case when r.reviewed_user_id = e.client_id then 'client' else 'developer' end,
  case when r.reviewer_id = e.client_id then 'client_to_developer' else 'developer_to_client' end,
  r.text, 'published', 'legacy', r.reviewer_name, r.reviewer_initials, r.project_title, r.rating,
  r.created_at, r.created_at, r.created_at
from public.project_reviews r
join public.project_engagements e on e.id = r.engagement_id
order by r.created_at, r.id
on conflict do nothing;

with legacy_state as (
  select a.id as agreement_id, a.conversation_id, a.client_id, a.developer_id,
    s.state,
    s.state #>> '{room,ratings,client,rating}' as client_rating,
    s.state #>> '{room,ratings,client,text}' as client_comment,
    nullif(s.state #>> '{room,ratings,client,at}', '')::timestamptz as client_submitted_at,
    s.state #>> '{room,ratings,developer,rating}' as developer_rating,
    s.state #>> '{room,ratings,developer,text}' as developer_comment,
    nullif(s.state #>> '{room,ratings,developer,at}', '')::timestamptz as developer_submitted_at,
    greatest(
      coalesce(nullif(s.state #>> '{room,result,acceptedAt}', '')::timestamptz,
        nullif(s.state #>> '{room,dispute,resolvedAt}', '')::timestamptz),
      coalesce(nullif(s.state #>> '{room,dispute,resolvedAt}', '')::timestamptz,
        nullif(s.state #>> '{room,result,acceptedAt}', '')::timestamptz)
    ) as opens_at
  from public.payment_agreement_rooms s
  join public.project_agreements a on a.id = s.agreement_id
  where a.payment_status = 'paid'
    and public.agreement_review_window_eligible(a.id, s.state)
),
legacy_ratings as (
  select l.*, 'client'::text as reviewer_role, l.client_id as reviewer_id,
    l.developer_id as reviewee_id, l.client_rating as rating,
    l.client_comment as comment, l.client_submitted_at as submitted_at
  from legacy_state l
  union all
  select l.*, 'developer'::text, l.developer_id, l.client_id,
    l.developer_rating, l.developer_comment, l.developer_submitted_at
  from legacy_state l
)
insert into public.agreement_reviews (
  engagement_id, agreement_id, reviewer_id, reviewee_id, reviewer_role, reviewee_role,
  direction, comment, status, source, reviewer_name, reviewer_initials, project_title,
  legacy_rating, submitted_at, published_at
)
select null, r.agreement_id, r.reviewer_id, r.reviewee_id, r.reviewer_role,
  case when r.reviewer_role = 'client' then 'developer' else 'client' end,
  case when r.reviewer_role = 'client' then 'client_to_developer' else 'developer_to_client' end,
  coalesce(r.comment, ''),
  case when (
      r.client_rating ~ '^[1-5]$' and r.developer_rating ~ '^[1-5]$'
      and r.client_submitted_at is not null and r.developer_submitted_at is not null
    ) or r.opens_at + interval '14 days' <= now()
    then 'published' else 'hidden' end,
  'legacy', p.display_name,
  upper(left(split_part(p.display_name, ' ', 1), 1)
    || coalesce(left(nullif(split_part(p.display_name, ' ', 2), ''), 1), '')),
  coalesce(nullif(r.state #>> '{room,proposal,name}', ''), 'Completed agreement'),
  r.rating::smallint, r.submitted_at,
  case when r.client_rating ~ '^[1-5]$' and r.developer_rating ~ '^[1-5]$'
      and r.client_submitted_at is not null and r.developer_submitted_at is not null
    then greatest(r.client_submitted_at, r.developer_submitted_at)
    when r.opens_at + interval '14 days' <= now()
    then r.opens_at + interval '14 days'
  end
from legacy_ratings r
join public.profiles p on p.id = r.reviewer_id
where r.rating ~ '^[1-5]$'
  and r.submitted_at is not null
  and r.submitted_at >= r.opens_at
  and char_length(coalesce(r.comment, '')) <= 2000
  and not exists (
    select 1 from public.agreement_reviews existing
    where existing.source = 'legacy'
      and existing.reviewer_id = r.reviewer_id
      and existing.reviewee_id = r.reviewee_id
      and (
        existing.agreement_id = r.agreement_id
        or (existing.engagement_id is not null and exists (
          select 1 from public.project_engagements e
          where e.id = existing.engagement_id
            and e.conversation_id = r.conversation_id
        ))
      )
  );

insert into public.agreement_review_windows (agreement_id, opens_at, closes_at)
select
  a.id,
  greatest(
    coalesce(nullif(s.state #>> '{room,result,acceptedAt}', '')::timestamptz,
      nullif(s.state #>> '{room,dispute,resolvedAt}', '')::timestamptz),
    coalesce(nullif(s.state #>> '{room,dispute,resolvedAt}', '')::timestamptz,
      nullif(s.state #>> '{room,result,acceptedAt}', '')::timestamptz)
  ),
  greatest(
    coalesce(nullif(s.state #>> '{room,result,acceptedAt}', '')::timestamptz,
      nullif(s.state #>> '{room,dispute,resolvedAt}', '')::timestamptz),
    coalesce(nullif(s.state #>> '{room,dispute,resolvedAt}', '')::timestamptz,
      nullif(s.state #>> '{room,result,acceptedAt}', '')::timestamptz)
  ) + interval '14 days'
from public.payment_agreement_rooms s
join public.project_agreements a on a.id = s.agreement_id
where public.agreement_review_window_eligible(s.agreement_id, s.state)
on conflict (agreement_id) do nothing;

create function public.get_public_review_aggregates(
  p_user_ids uuid[],
  p_profile_role text
) returns table (
  user_id uuid,
  profile_role text,
  review_count integer,
  overall_rating numeric,
  adjusted_rating numeric,
  quality_of_work numeric,
  communication numeric,
  meeting_deadline numeric,
  clarity_of_brief numeric,
  responsiveness numeric,
  respecting_scope numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, a.profile_role, a.review_count,
    a.overall_score_units::numeric / (3 * a.review_count),
    (a.overall_score_units + 3 * 4 * 5)::numeric / (3 * (a.review_count + 5)),
    case when a.profile_role = 'developer' and a.criteria_review_count > 0
      then a.quality_of_work_sum::numeric / a.criteria_review_count end,
    case when a.profile_role = 'developer' and a.criteria_review_count > 0
      then a.communication_sum::numeric / a.criteria_review_count end,
    case when a.profile_role = 'developer' and a.criteria_review_count > 0
      then a.meeting_deadline_sum::numeric / a.criteria_review_count end,
    case when a.profile_role = 'client' and a.criteria_review_count > 0
      then a.clarity_of_brief_sum::numeric / a.criteria_review_count end,
    case when a.profile_role = 'client' and a.criteria_review_count > 0
      then a.responsiveness_sum::numeric / a.criteria_review_count end,
    case when a.profile_role = 'client' and a.criteria_review_count > 0
      then a.respecting_scope_sum::numeric / a.criteria_review_count end
  from public.agreement_rating_aggregates a
  where a.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
    and a.profile_role = p_profile_role
    and a.review_count > 0;
$$;

create function public.get_public_rating_summary(p_user_id uuid, p_profile_role text)
returns table (
  review_count integer,
  overall_rating numeric,
  adjusted_rating numeric,
  quality_of_work numeric,
  communication numeric,
  meeting_deadline numeric,
  clarity_of_brief numeric,
  responsiveness numeric,
  respecting_scope numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.review_count, a.overall_rating, a.adjusted_rating, a.quality_of_work,
    a.communication, a.meeting_deadline, a.clarity_of_brief, a.responsiveness,
    a.respecting_scope
  from public.get_public_review_aggregates(array[p_user_id], p_profile_role) a;
$$;

create function public.get_profile_reviews(p_profile_id uuid, p_profile_role text)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating numeric,
  text text,
  created_at timestamptz,
  quality_of_work smallint,
  communication smallint,
  meeting_deadline smallint,
  clarity_of_brief smallint,
  responsiveness smallint,
  respecting_scope smallint,
  delivery_badge text,
  reply text,
  source text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.reviewer_name, r.reviewer_initials, r.project_title,
    case when r.source = 'legacy' then r.legacy_rating::numeric
      when r.reviewer_role = 'client'
        then (r.quality_of_work + r.communication + r.meeting_deadline)::numeric / 3
      else (r.clarity_of_brief + r.responsiveness + r.respecting_scope)::numeric / 3
    end,
    r.comment, r.published_at, r.quality_of_work, r.communication, r.meeting_deadline,
    r.clarity_of_brief, r.responsiveness, r.respecting_scope, r.delivery_badge,
    reply.comment, r.source
  from public.agreement_reviews r
  left join public.agreement_review_replies reply on reply.review_id = r.id
  where r.reviewee_id = p_profile_id
    and r.reviewee_role = p_profile_role
    and r.status = 'published'
  order by r.published_at desc, r.id;
$$;

create or replace function public.get_profile_reviews(p_profile_id uuid)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.reviewer_name, r.reviewer_initials, r.project_title,
    round(r.rating)::smallint, r.text, r.created_at
  from public.get_profile_reviews(p_profile_id,
    case when (select account_role from public.profiles where id = p_profile_id) = 'dev'
      then 'developer' else 'client' end) r;
$$;

create function public.get_my_agreement_review_state(p_agreement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_agreement public.project_agreements%rowtype;
  v_window public.agreement_review_windows%rowtype;
  v_role text;
  v_reviewee_id uuid;
  v_own_review public.agreement_reviews%rowtype;
  v_counterpart_review public.agreement_reviews%rowtype;
begin
  select * into v_agreement from public.project_agreements where id = p_agreement_id;
  if not found or auth.uid() not in (v_agreement.client_id, v_agreement.developer_id) then
    raise exception 'Agreement participant access is required' using errcode = '42501';
  end if;
  v_role := case when auth.uid() = v_agreement.client_id then 'client' else 'developer' end;
  v_reviewee_id := case when v_role = 'client' then v_agreement.developer_id else v_agreement.client_id end;
  select * into v_window from public.agreement_review_windows where agreement_id = p_agreement_id;
  select * into v_own_review from public.agreement_reviews
    where reviewer_id = auth.uid()
      and (agreement_id = p_agreement_id or (
        source = 'legacy' and exists (
          select 1 from public.project_engagements e
          where e.id = agreement_reviews.engagement_id
            and e.conversation_id = v_agreement.conversation_id
        )
      ))
    order by (agreement_id = p_agreement_id) desc
    limit 1;
  select * into v_counterpart_review from public.agreement_reviews
    where reviewer_id = v_reviewee_id
      and (agreement_id = p_agreement_id or (
        source = 'legacy' and exists (
          select 1 from public.project_engagements e
          where e.id = agreement_reviews.engagement_id
            and e.conversation_id = v_agreement.conversation_id
        )
      ))
    order by (agreement_id = p_agreement_id) desc
    limit 1;
  return jsonb_build_object(
    'canReview', v_window.agreement_id is not null and now() >= v_window.opens_at
      and now() < v_window.closes_at and v_own_review.id is null,
    'hasSubmitted', v_own_review.id is not null,
    'counterpartSubmitted', v_counterpart_review.id is not null,
    'published', coalesce(v_own_review.status = 'published', false),
    'opensAt', v_window.opens_at,
    'closesAt', v_window.closes_at,
    'submittedAt', v_own_review.submitted_at
  );
end;
$$;

create function public.submit_agreement_review(
  p_agreement_id uuid,
  p_criteria jsonb,
  p_comment text default ''
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement public.project_agreements%rowtype;
  v_state jsonb;
  v_window public.agreement_review_windows%rowtype;
  v_role text;
  v_reviewee_id uuid;
  v_reviewer_name text;
  v_reviewer_initials text;
  v_title text;
  v_badge text;
  v_deadline date;
  v_delivered_at date;
  v_review_id uuid;
  v_counterpart_id uuid;
  v_counterpart_submitted boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  select * into v_agreement from public.project_agreements where id = p_agreement_id for update;
  if not found or auth.uid() not in (v_agreement.client_id, v_agreement.developer_id) then
    raise exception 'Agreement participant access is required' using errcode = '42501';
  end if;
  v_role := case when auth.uid() = v_agreement.client_id then 'client' else 'developer' end;
  v_reviewee_id := case when v_role = 'client' then v_agreement.developer_id else v_agreement.client_id end;
  select state into v_state from public.payment_agreement_rooms
    where agreement_id = p_agreement_id for update;
  if not public.agreement_review_window_eligible(p_agreement_id, v_state) then
    raise exception 'Only completed, paid agreements can be reviewed' using errcode = '23514';
  end if;
  select * into v_window from public.agreement_review_windows where agreement_id = p_agreement_id for update;
  if not found then raise exception 'The review window is not available' using errcode = '23514'; end if;
  if now() < v_window.opens_at or now() >= v_window.closes_at then
    raise exception 'The 14-day review window has closed or is not open yet' using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.agreement_reviews legacy
    join public.project_engagements e on e.id = legacy.engagement_id
    where legacy.source = 'legacy'
      and legacy.reviewer_id = auth.uid()
      and legacy.reviewee_id = v_reviewee_id
      and e.conversation_id = v_agreement.conversation_id
  ) then
    raise exception 'A legacy review already exists for this project and direction'
      using errcode = '23514';
  end if;
  select exists (
    select 1 from public.agreement_reviews
    where agreement_id = p_agreement_id and reviewer_id = v_reviewee_id
  ) into v_counterpart_submitted;
  if jsonb_typeof(p_criteria) <> 'object' or char_length(coalesce(p_comment, '')) > 500 then
    raise exception 'Invalid criteria or comment length' using errcode = '23514';
  end if;
  if (v_role = 'client' and (
      (select count(*) from jsonb_object_keys(p_criteria)) <> 3
      or coalesce(p_criteria->>'qualityOfWork' !~ '^[1-5]$', true)
      or coalesce(p_criteria->>'communication' !~ '^[1-5]$', true)
      or coalesce(p_criteria->>'meetingDeadline' !~ '^[1-5]$', true)))
    or (v_role = 'developer' and (
      (select count(*) from jsonb_object_keys(p_criteria)) <> 3
      or coalesce(p_criteria->>'clarityOfBrief' !~ '^[1-5]$', true)
      or coalesce(p_criteria->>'responsiveness' !~ '^[1-5]$', true)
      or coalesce(p_criteria->>'respectingScope' !~ '^[1-5]$', true)))
  then raise exception 'Each required criterion must be an integer from 1 to 5' using errcode = '23514'; end if;
  select nullif(trim(display_name), '') into v_reviewer_name from public.profiles where id = auth.uid();
  if v_reviewer_name is null then raise exception 'A profile name is required' using errcode = '23514'; end if;
  v_reviewer_initials := upper(left(split_part(v_reviewer_name, ' ', 1), 1)
    || coalesce(left(nullif(split_part(v_reviewer_name, ' ', 2), ''), 1), ''));
  v_title := coalesce(nullif(v_state #>> '{room,proposal,name}', ''), 'Completed agreement');
  v_deadline := nullif(v_state #>> '{room,proposal,deadline}', '')::date;
  v_delivered_at := nullif(v_state #>> '{room,handover,at}', '')::date;
  if v_role = 'client' and v_deadline is not null and v_delivered_at is not null then
    v_badge := case when v_delivered_at <= v_deadline then 'Delivered on time'
      else 'Delivered ' || (v_delivered_at - v_deadline)::text || ' days late' end;
  end if;

  insert into public.agreement_reviews (
    agreement_id, reviewer_id, reviewee_id, reviewer_role, reviewee_role, direction,
    quality_of_work, communication, meeting_deadline, clarity_of_brief, responsiveness,
    respecting_scope, comment, source, reviewer_name, reviewer_initials, project_title,
    delivery_badge, status
  ) values (
    p_agreement_id, auth.uid(), v_reviewee_id, v_role,
    case when v_role = 'client' then 'developer' else 'client' end,
    case when v_role = 'client' then 'client_to_developer' else 'developer_to_client' end,
    case when v_role = 'client' then (p_criteria->>'qualityOfWork')::smallint end,
    case when v_role = 'client' then (p_criteria->>'communication')::smallint end,
    case when v_role = 'client' then (p_criteria->>'meetingDeadline')::smallint end,
    case when v_role = 'developer' then (p_criteria->>'clarityOfBrief')::smallint end,
    case when v_role = 'developer' then (p_criteria->>'responsiveness')::smallint end,
    case when v_role = 'developer' then (p_criteria->>'respectingScope')::smallint end,
    trim(coalesce(p_comment, '')), 'agreement', v_reviewer_name, v_reviewer_initials,
    v_title, v_badge, 'hidden'
  ) returning id into v_review_id;

  v_counterpart_id := v_reviewee_id;
  if v_counterpart_submitted then
    update public.agreement_reviews
      set status = 'published', published_at = now()
      where agreement_id = p_agreement_id and reviewer_id = v_counterpart_id and status = 'hidden';
    update public.agreement_reviews set status = 'published', published_at = now() where id = v_review_id;
  end if;
  return v_review_id;
end;
$$;

create function public.add_agreement_review_reply(p_review_id uuid, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.agreement_reviews%rowtype;
  v_name text;
  v_reply_id uuid;
begin
  select * into v_review from public.agreement_reviews where id = p_review_id and status = 'published';
  if not found or v_review.reviewee_id <> auth.uid() then
    raise exception 'Only the reviewed party can reply to a published review' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_comment, ''))) not between 1 and 500 then
    raise exception 'A reply from 1 to 500 characters is required' using errcode = '23514';
  end if;
  select nullif(trim(display_name), '') into v_name from public.profiles where id = auth.uid();
  if v_name is null then raise exception 'A profile name is required' using errcode = '23514'; end if;
  insert into public.agreement_review_replies (review_id, author_id, author_name, comment)
  values (p_review_id, auth.uid(), v_name, trim(p_comment))
  returning review_id into v_reply_id;
  return v_reply_id;
end;
$$;

create function public.report_agreement_review(p_review_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'A report reason from 1 to 500 characters is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.agreement_reviews
    where id = p_review_id and status = 'published'
      and reviewee_id <> auth.uid() and reviewer_id <> auth.uid()
  ) then raise exception 'This review cannot be reported' using errcode = '23514'; end if;
  insert into public.agreement_review_reports (review_id, reporter_id, reason)
  values (p_review_id, auth.uid(), trim(p_reason))
  returning id into v_report_id;
  return v_report_id;
end;
$$;

create function public.get_agreement_review_reports()
returns table (report_id uuid, review_id uuid, reason text, created_at timestamptz,
  reviewer_name text, review_text text, agreement_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.agreement_review_moderators where user_id = auth.uid()) then
    raise exception 'Review moderator access is required' using errcode = '42501';
  end if;
  return query
    select report.id, review.id, report.reason, report.created_at,
      review.reviewer_name, review.comment, review.agreement_id
    from public.agreement_review_reports report
    join public.agreement_reviews review on review.id = report.review_id
    where report.status = 'pending'
    order by report.created_at;
end;
$$;

create function public.moderate_agreement_review(p_review_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.agreement_review_moderators where user_id = auth.uid()) then
    raise exception 'Review moderator access is required' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'remove', 'dismiss') then
    raise exception 'Moderation action must be hide, remove, or dismiss' using errcode = '22023';
  end if;
  if p_action = 'dismiss' then
    update public.agreement_review_reports set status = 'dismissed'
      where review_id = p_review_id and status = 'pending';
    if not found then raise exception 'Pending review report not found' using errcode = 'P0002'; end if;
    return;
  end if;
  update public.agreement_reviews set status = case when p_action = 'hide' then 'hidden' else 'removed' end,
    published_at = null
    where id = p_review_id and status = 'published';
  if not found then raise exception 'Published review not found' using errcode = 'P0002'; end if;
  update public.agreement_review_reports set status = 'actioned' where review_id = p_review_id;
end;
$$;

create function public.process_due_agreement_reviews(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window public.agreement_review_windows%rowtype;
  v_agreement public.project_agreements%rowtype;
  v_published integer := 0;
  v_current_published integer := 0;
begin
  for v_window in
    select * from public.agreement_review_windows
    where closes_at <= p_now or (reminder_sent_at is null and closes_at <= p_now + interval '3 days')
    for update
  loop
    select * into v_agreement from public.project_agreements where id = v_window.agreement_id;
    if v_window.reminder_sent_at is null and v_window.closes_at > p_now then
      if not exists (select 1 from public.agreement_reviews
        where agreement_id = v_window.agreement_id and reviewer_id = v_agreement.client_id) then
        perform public.insert_agreement_rating_notification(v_window.agreement_id,
          v_agreement.client_id, v_agreement.developer_id, 'reminder');
      end if;
      if not exists (select 1 from public.agreement_reviews
        where agreement_id = v_window.agreement_id and reviewer_id = v_agreement.developer_id) then
        perform public.insert_agreement_rating_notification(v_window.agreement_id,
          v_agreement.developer_id, v_agreement.client_id, 'reminder');
      end if;
      update public.agreement_review_windows set reminder_sent_at = p_now
        where agreement_id = v_window.agreement_id;
    end if;
    if v_window.closes_at <= p_now then
      update public.agreement_reviews set status = 'published', published_at = p_now
        where agreement_id = v_window.agreement_id and status = 'hidden';
      get diagnostics v_current_published = row_count;
      v_published := v_published + v_current_published;
    end if;
  end loop;
  return v_published;
end;
$$;

revoke all on function public.update_agreement_rating_aggregate() from public, anon, authenticated;
revoke all on function public.insert_agreement_rating_notification(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.agreement_review_window_eligible(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.sync_agreement_review_window() from public, anon, authenticated;
revoke all on function public.publish_agreement_review_notification() from public, anon, authenticated;
revoke all on function public.get_public_review_aggregates(uuid[], text) from public, anon, authenticated;
revoke all on function public.get_public_rating_summary(uuid, text) from public, anon, authenticated;
revoke all on function public.get_profile_reviews(uuid, text) from public, anon, authenticated;
revoke all on function public.get_profile_reviews(uuid) from public, anon, authenticated;
revoke all on function public.get_my_agreement_review_state(uuid) from public, anon, authenticated;
revoke all on function public.submit_agreement_review(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.add_agreement_review_reply(uuid, text) from public, anon, authenticated;
revoke all on function public.report_agreement_review(uuid, text) from public, anon, authenticated;
revoke all on function public.get_agreement_review_reports() from public, anon, authenticated;
revoke all on function public.moderate_agreement_review(uuid, text) from public, anon, authenticated;
revoke all on function public.process_due_agreement_reviews(timestamptz) from public, anon, authenticated;
grant execute on function public.get_public_review_aggregates(uuid[], text),
  public.get_public_rating_summary(uuid, text),
  public.get_profile_reviews(uuid, text),
  public.get_profile_reviews(uuid) to anon, authenticated;
grant execute on function public.get_my_agreement_review_state(uuid),
  public.submit_agreement_review(uuid, jsonb, text),
  public.add_agreement_review_reply(uuid, text),
  public.report_agreement_review(uuid, text),
  public.get_agreement_review_reports(),
  public.moderate_agreement_review(uuid, text) to authenticated;
grant execute on function public.process_due_agreement_reviews(timestamptz) to service_role;

create or replace function public.submit_project_review(
  p_engagement_id uuid,
  p_rating smallint,
  p_text text default ''
)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Reviews must be submitted for a completed, paid agreement'
    using errcode = '23514';
end;
$$;
revoke all on function public.submit_project_review(uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.submit_project_review(uuid, smallint, text) to authenticated;

do $$
begin
  if to_regclass('cron.job') is not null then
    execute 'select cron.schedule($1, $2, $3)'
      using 'devmatch-agreement-review-windows', '* * * * *',
        'select public.process_due_agreement_reviews(now())';
  end if;
end;
$$;

commit;
