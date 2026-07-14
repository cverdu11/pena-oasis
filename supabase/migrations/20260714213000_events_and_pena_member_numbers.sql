create sequence if not exists public.pena_member_number_seq;

alter table public.profiles
  add column if not exists pena_member_number integer;

comment on column public.profiles.pena_member_number is
  'Sequential Peña Oasis member number. Store as an integer and format with leading zeroes in the UI.';

create unique index if not exists profiles_pena_member_number_key
  on public.profiles (pena_member_number)
  where pena_member_number is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_pena_member_number_positive'
  ) then
    alter table public.profiles
      add constraint profiles_pena_member_number_positive
      check (pena_member_number is null or pena_member_number > 0);
  end if;
end
$$;

do $$
declare
  profile_count bigint;
  highest_member_number bigint;
  sequence_value bigint;
  sequence_was_called boolean;
  reserved_number bigint;
begin
  select count(*), coalesce(max(pena_member_number), 0)
    into profile_count, highest_member_number
  from public.profiles;

  select last_value, is_called
    into sequence_value, sequence_was_called
  from public.pena_member_number_seq;

  reserved_number := greatest(
    profile_count,
    highest_member_number,
    case when sequence_was_called then sequence_value else 0 end
  );

  if reserved_number = 0 then
    perform setval('public.pena_member_number_seq', 1, false);
  else
    perform setval(
      'public.pena_member_number_seq',
      reserved_number,
      true
    );
  end if;
end
$$;

alter sequence public.pena_member_number_seq
  owned by public.profiles.pena_member_number;

alter table public.profiles
  alter column pena_member_number
  set default nextval('public.pena_member_number_seq');

create table if not exists public.events (
  id text primary key
    check (
      id = btrim(id)
      and char_length(id) between 1 and 100
    ),
  kind text not null
    check (kind in ('travel', 'home')),
  category text not null
    check (category = btrim(category) and category <> ''),
  title text not null
    check (title = btrim(title) and title <> ''),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_label text not null
    check (time_label = btrim(time_label) and time_label <> ''),
  location text not null
    check (location = btrim(location) and location <> ''),
  detail text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_valid_date_range check (ends_at >= starts_at)
);

comment on table public.events is
  'Peña Oasis events. Published rows appear in the app; events remain stored after their end date.';

create index if not exists events_published_starts_at_idx
  on public.events (starts_at)
  where is_published;

create or replace function public.set_event_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_updated_at on public.events;

create trigger set_event_updated_at
before update on public.events
for each row
execute function public.set_event_updated_at();

revoke all on function public.set_event_updated_at() from public;

alter table public.events enable row level security;

drop policy if exists "Published events are publicly readable"
  on public.events;

create policy "Published events are publicly readable"
on public.events
for select
to anon, authenticated
using (is_published);

revoke all on table public.events from public;
revoke all on table public.events from anon;
revoke all on table public.events from authenticated;
grant select on table public.events to anon, authenticated;

insert into public.events (
  id,
  kind,
  category,
  title,
  starts_at,
  ends_at,
  time_label,
  location,
  detail,
  is_published
)
values
  (
    'madrid-trip-2026-08-19',
    'travel',
    'On Tour',
    'Atlético de Madrid - Málaga',
    '2026-08-19 12:00:00+02',
    '2026-08-19 23:59:59+02',
    'Horario de salida por confirmar',
    'Madrid',
    'Desplazamiento para el partido fuera de casa.',
    true
  ),
  (
    'home-preview-2026-08-24',
    'home',
    'Previa en casa',
    'Previa del partido en casa',
    '2026-08-24 19:30:00+02',
    '2026-08-24 21:30:00+02',
    '19:30',
    'Punto de encuentro por confirmar',
    'Nos vemos dos horas antes. El partido comienza a las 21:30.',
    true
  )
on conflict (id) do update set
  kind = excluded.kind,
  category = excluded.category,
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  time_label = excluded.time_label,
  location = excluded.location,
  detail = excluded.detail,
  is_published = excluded.is_published;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_attendance_responses'::regclass
      and conname = 'event_attendance_responses_event_id_fkey'
  ) then
    alter table public.event_attendance_responses
      add constraint event_attendance_responses_event_id_fkey
      foreign key (event_id)
      references public.events (id)
      on delete restrict;
  end if;
end
$$;
