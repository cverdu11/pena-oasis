create table public.travel_map_imports (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seed_version text not null,
  imported_at timestamptz not null default now(),
  constraint travel_map_imports_seed_version_not_blank
    check (length(btrim(seed_version)) > 0)
);

alter table public.travel_map_imports enable row level security;

create policy "Users read their travel import state"
on public.travel_map_imports
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users add their travel import state"
on public.travel_map_imports
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their travel import state"
on public.travel_map_imports
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.travel_map_imports from anon;
grant select, insert, update on table public.travel_map_imports to authenticated;
