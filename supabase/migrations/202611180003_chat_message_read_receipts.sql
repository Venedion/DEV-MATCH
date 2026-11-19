begin;

alter table public.messages
  add column read_at timestamptz;

commit;
