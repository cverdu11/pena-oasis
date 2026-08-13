-- Registers an owner-entered sale as a fulfilled reservation so the same
-- inventory triggers account for web reservations and outside sales.

create or replace function public.register_external_shirt_sale(
  reservation_label_arg text,
  reservation_customer_type_arg text,
  reservation_items_arg jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_reservation_id uuid;
  order_total_quantity integer;
  item_unit_price smallint;
  reservation_label text;
begin
  if auth.uid() is null or not private.is_shirt_stock_admin() then
    raise exception 'Shirt stock administrator access is required'
      using errcode = '42501';
  end if;

  reservation_label := coalesce(nullif(btrim(reservation_label_arg), ''), 'Venta externa');

  if char_length(reservation_label) not between 2 and 100 then
    raise exception 'The external sale label must contain between 2 and 100 characters'
      using errcode = '22023';
  end if;

  if reservation_customer_type_arg not in ('member', 'non-member') then
    raise exception 'Invalid external sale customer type'
      using errcode = '22023';
  end if;

  item_unit_price := case reservation_customer_type_arg
    when 'member' then 15
    else 20
  end;

  order_total_quantity :=
    private.validate_shirt_reservation_items(reservation_items_arg);

  -- Insert as pending because the inventory trigger deliberately rejects a
  -- direct fulfilled insert before its item rows exist. The following update
  -- runs in this same function transaction and consumes stock atomically.
  insert into public.shirt_reservations (
    user_id,
    full_name,
    email,
    customer_type,
    total_quantity,
    total_price_eur,
    status
  )
  values (
    null,
    reservation_label,
    'venta.externa@pena-oasis.local',
    reservation_customer_type_arg,
    order_total_quantity,
    order_total_quantity * item_unit_price,
    'pending'
  )
  returning id into created_reservation_id;

  perform private.replace_shirt_reservation_items(
    created_reservation_id,
    reservation_items_arg,
    item_unit_price
  );

  update public.shirt_reservations
  set
    status = 'fulfilled',
    updated_at = now(),
    version = public.shirt_reservations.version + 1
  where id = created_reservation_id;

  return created_reservation_id;
end;
$$;

revoke all on function public.register_external_shirt_sale(text, text, jsonb)
  from public;
revoke all on function public.register_external_shirt_sale(text, text, jsonb)
  from anon;
grant execute on function public.register_external_shirt_sale(text, text, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
