create table public.visited_places (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  name text not null,
  admin1 text,
  country text not null,
  country_code text not null,
  continent text not null,
  latitude double precision not null,
  longitude double precision not null,
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visited_places_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint visited_places_continent_valid check (
    continent in ('Europa', 'Asia', 'África', 'América', 'Oceanía')
  ),
  constraint visited_places_latitude_valid check (latitude between -90 and 90),
  constraint visited_places_longitude_valid check (longitude between -180 and 180),
  constraint visited_places_user_source_unique unique (user_id, source_id)
);

create index visited_places_user_id_idx
on public.visited_places (user_id);

create index visited_places_user_country_idx
on public.visited_places (user_id, country_code);

create index visited_places_user_added_at_idx
on public.visited_places (user_id, added_at desc);

create table public.manual_countries (
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, country_code),
  constraint manual_countries_country_code_format check (country_code ~ '^[A-Z]{2}$')
);

alter table public.visited_places enable row level security;
alter table public.manual_countries enable row level security;

create policy "Users read their visited places"
on public.visited_places
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users add their visited places"
on public.visited_places
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their visited places"
on public.visited_places
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their visited places"
on public.visited_places
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their manual countries"
on public.manual_countries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users add their manual countries"
on public.manual_countries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users delete their manual countries"
on public.manual_countries
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.visited_places from anon;
revoke all on table public.manual_countries from anon;
grant select, insert, update, delete on table public.visited_places to authenticated;
grant select, insert, delete on table public.manual_countries to authenticated;
grant usage, select on sequence public.visited_places_id_seq to authenticated;

create or replace function public.set_travel_data_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger visited_places_set_updated_at
before update on public.visited_places
for each row
execute function public.set_travel_data_updated_at();

revoke all on function public.set_travel_data_updated_at() from public;
grant execute on function public.set_travel_data_updated_at() to authenticated;
