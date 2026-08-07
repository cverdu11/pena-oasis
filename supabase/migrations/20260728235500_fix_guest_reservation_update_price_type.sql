create or replace function public.update_guest_shirt_reservation(
  reservation_id_arg uuid,
  management_token_arg text,
  expected_version_arg integer,
  reservation_items_arg jsonb
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
  order_total_quantity integer;
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
    raise exception 'Only pending reservations can be modified'
      using errcode = '55000';
  end if;

  if current_version <> expected_version_arg then
    raise exception 'Reservation has changed'
      using errcode = '40001';
  end if;

  order_total_quantity := private.replace_shirt_reservation_items(
    reservation_id_arg,
    reservation_items_arg,
    20::smallint
  );

  update public.shirt_reservations
  set
    total_quantity = order_total_quantity,
    total_price_eur = order_total_quantity * 20,
    updated_at = now(),
    version = public.shirt_reservations.version + 1
  where id = reservation_id_arg
  returning version into next_version;

  return next_version;
end;
$$;

revoke all on function public.update_guest_shirt_reservation(
  uuid,
  text,
  integer,
  jsonb
) from public;

grant execute on function public.update_guest_shirt_reservation(
  uuid,
  text,
  integer,
  jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
