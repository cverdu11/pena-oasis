create or replace function public.is_valid_founding_sponsor(candidate_name text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select lower(
    btrim(
      regexp_replace(
        translate(
          coalesce(candidate_name, ''),
          'ÁÉÍÓÚÜÑáéíóúüñ',
          'AEIOUUNaeiouun'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  ) = any (
    array[
      'carlos verdu',
      'luis perez',
      'josemi alarcon',
      'jose aciego',
      'luis alberto',
      'jd honorato',
      'julio navarrete',
      'gabriel aciego',
      'fali sanchez',
      'antonio gonzalez',
      'juanga ruiz'
    ]::text[]
  );
$function$;

comment on function public.is_valid_founding_sponsor(text) is
  'Validates the required founding sponsor supplied during Peña Oasis sign-up.';

revoke all on function public.is_valid_founding_sponsor(text) from public;
grant execute on function public.is_valid_founding_sponsor(text) to anon, authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_valid_founding_sponsor(
    new.raw_user_meta_data ->> 'sponsor_name'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Invalid founding sponsor';
  end if;

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
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
