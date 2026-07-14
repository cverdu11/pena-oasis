alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists dni text,
  add column if not exists member_number text,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_notice_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists data_agreement_signed_at timestamptz,
  add column if not exists data_agreement_file_name text,
  add column if not exists data_agreement_drive_file_id text,
  add column if not exists data_agreement_drive_url text,
  add column if not exists data_agreement_status text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    avatar_url,
    privacy_accepted_at,
    privacy_notice_version,
    terms_accepted_at,
    terms_version
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    split_part(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ' ', 1),
    nullif(
      btrim(
        regexp_replace(
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
          '^\S+\s*',
          ''
        )
      ),
      ''
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'privacy_accepted_at', '')::timestamptz,
    new.raw_user_meta_data ->> 'privacy_notice_version',
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz,
    new.raw_user_meta_data ->> 'terms_version'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    privacy_accepted_at = coalesce(excluded.privacy_accepted_at, public.profiles.privacy_accepted_at),
    privacy_notice_version = coalesce(excluded.privacy_notice_version, public.profiles.privacy_notice_version),
    terms_accepted_at = coalesce(excluded.terms_accepted_at, public.profiles.terms_accepted_at),
    terms_version = coalesce(excluded.terms_version, public.profiles.terms_version),
    updated_at = now();

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
    on public.profiles
    for insert
    to authenticated
    with check ((select auth.uid()) = id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
    on public.profiles
    for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);
  end if;
end
$$;
