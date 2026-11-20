-- Non-destructive rollback: remove the primary-pair uniqueness guard and
-- restore authenticated's original table-level project INSERT/UPDATE access.
-- Do not remove messages.project_id or any message/conversation metadata.

begin;

drop index if exists public.conversations_single_primary_pair_idx;

revoke insert (
  owner_id,
  project_kind,
  legacy_id,
  title,
  project_type,
  category,
  price,
  price_type,
  cover_image,
  status,
  data,
  created_at,
  updated_at
) on table public.projects from authenticated;

revoke update (
  owner_id,
  project_kind,
  legacy_id,
  title,
  project_type,
  category,
  price,
  price_type,
  cover_image,
  status,
  data,
  created_at,
  updated_at
) on table public.projects from authenticated;

revoke insert (id), update (id) on table public.projects from authenticated;
grant insert, update on table public.projects to authenticated;

commit;
