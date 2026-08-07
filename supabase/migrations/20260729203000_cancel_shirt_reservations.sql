create or replace function public.cancel_my_shirt_reservation(
  reservation_id_arg uuid,
  expected_version_arg integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_version integer;
  next_version integer;
  reservation_user_id uuid := (select auth.uid());
begin
  if reservation_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select status, version
  into current_status, current_version
  from public.shirt_reservations
  where id = reservation_id_arg
    and user_id = reservation_user_id
  for update;

  if not found then
    raise exception 'Reservation not found'
      using errcode = 'P0002';
  end if;

  if current_status <> 'pending' then
    raise exception 'Only pending reservations can be cancelled'
      using errcode = '55000';
  end if;

  if current_version <> expected_version_arg then
    raise exception 'Reservation has changed'
      using errcode = '40001';
  end if;

  update public.shirt_reservations
  set
    status = 'cancelled',
    updated_at = now(),
    version = public.shirt_reservations.version + 1
  where id = reservation_id_arg
  returning version into next_version;

  return next_version;
end;
$$;

revoke all on function public.cancel_my_shirt_reservation(
  uuid,
  integer
) from public;

grant execute on function public.cancel_my_shirt_reservation(
  uuid,
  integer
) to authenticated;

create or replace function public.cancel_guest_shirt_reservation(
  reservation_id_arg uuid,
  management_token_arg text,
  expected_version_arg integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_version integer;
  next_version integer;
begin
  if management_token_arg is null
    or management_token_arg !~ '^[0-9a-fA-F]{64}$'
  then
    raise exception 'Invalid management token'
      using errcode = '42501';
  end if;

  select reservation.status, reservation.version
  into current_status, current_version
  from public.shirt_reservations as reservation
  where reservation.id = reservation_id_arg
    and reservation.user_id is null
    and exists (
      select 1
      from public.shirt_reservation_management_tokens as token
      where token.reservation_id = reservation.id
        and token.token_hash = encode(
          extensions.digest(management_token_arg, 'sha256'),
          'hex'
        )
        and token.revoked_at is null
        and token.expires_at > now()
    )
  for update;

  if not found then
    raise exception 'Reservation not found'
      using errcode = 'P0002';
  end if;

  if current_status <> 'pending' then
    raise exception 'Only pending reservations can be cancelled'
      using errcode = '55000';
  end if;

  if current_version <> expected_version_arg then
    raise exception 'Reservation has changed'
      using errcode = '40001';
  end if;

  update public.shirt_reservations
  set
    status = 'cancelled',
    updated_at = now(),
    version = public.shirt_reservations.version + 1
  where id = reservation_id_arg
  returning version into next_version;

  return next_version;
end;
$$;

revoke all on function public.cancel_guest_shirt_reservation(
  uuid,
  text,
  integer
) from public;

grant execute on function public.cancel_guest_shirt_reservation(
  uuid,
  text,
  integer
) to anon, authenticated;

notify pgrst, 'reload schema';
