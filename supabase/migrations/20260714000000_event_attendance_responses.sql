create table if not exists public.event_attendance_responses (
  event_id text not null
    check (
      event_id = btrim(event_id)
      and char_length(event_id) between 1 and 100
    ),
  user_id uuid not null references auth.users (id) on delete cascade,
  attending boolean not null,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

comment on table public.event_attendance_responses is
  'One attendance response per authenticated user and event.';

create index if not exists event_attendance_responses_attending_event_idx
  on public.event_attendance_responses (event_id)
  where attending;

create or replace function public.set_event_attendance_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_attendance_updated_at
  on public.event_attendance_responses;

create trigger set_event_attendance_updated_at
before update on public.event_attendance_responses
for each row
execute function public.set_event_attendance_updated_at();

revoke all on function public.set_event_attendance_updated_at() from public;

alter table public.event_attendance_responses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendance_responses'
      and policyname = 'Users can read own event responses'
  ) then
    create policy "Users can read own event responses"
    on public.event_attendance_responses
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendance_responses'
      and policyname = 'Users can insert own event responses'
  ) then
    create policy "Users can insert own event responses"
    on public.event_attendance_responses
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendance_responses'
      and policyname = 'Users can update own event responses'
  ) then
    create policy "Users can update own event responses"
    on public.event_attendance_responses
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendance_responses'
      and policyname = 'Users can delete own event responses'
  ) then
    create policy "Users can delete own event responses"
    on public.event_attendance_responses
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;
end
$$;

revoke all on table public.event_attendance_responses from public;
revoke all on table public.event_attendance_responses from anon;
revoke all on table public.event_attendance_responses from authenticated;
grant select, insert, update, delete
  on table public.event_attendance_responses
  to authenticated;

create or replace function public.get_event_attendance_counts(
  requested_event_ids text[]
)
returns table (
  event_id text,
  attendee_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    response.event_id,
    count(*)::bigint as attendee_count
  from public.event_attendance_responses as response
  where response.attending
    and response.event_id = any (
      coalesce(requested_event_ids, array[]::text[])
    )
  group by response.event_id;
$$;

revoke all on function public.get_event_attendance_counts(text[]) from public;
grant execute on function public.get_event_attendance_counts(text[])
  to anon, authenticated;
