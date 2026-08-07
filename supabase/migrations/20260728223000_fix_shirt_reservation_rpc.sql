create or replace function public.create_shirt_reservation(
  reservation_full_name text,
  reservation_email text,
  reservation_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_reservation_id uuid;
  reservation_item jsonb;
  item_color text;
  item_size text;
  item_quantity integer;
  item_unit_price smallint;
  order_total_quantity integer := 0;
  reservation_customer_type text;
  reservation_user_id uuid := (select auth.uid());
begin
  if reservation_items is null
    or jsonb_typeof(reservation_items) <> 'array'
  then
    raise exception 'Reservation items must be an array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(reservation_items) not between 1 and 10 then
    raise exception 'A reservation requires between 1 and 10 item lines'
      using errcode = '22023';
  end if;

  for reservation_item in
    select value
    from jsonb_array_elements(reservation_items)
  loop
    item_color := reservation_item ->> 'color';
    item_size := reservation_item ->> 'size';

    begin
      item_quantity := (reservation_item ->> 'quantity')::integer;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Invalid item quantity'
          using errcode = '22023';
    end;

    if item_color is null
      or item_size is null
      or item_quantity is null
      or item_color not in ('white', 'blue')
      or item_size not in ('S', 'M', 'L', 'XL', '2XL')
      or item_quantity not between 1 and 10
    then
      raise exception 'Invalid reservation item'
        using errcode = '22023';
    end if;

    order_total_quantity := order_total_quantity + item_quantity;
  end loop;

  if order_total_quantity > 20 then
    raise exception 'A reservation cannot exceed 20 shirts'
      using errcode = '22023';
  end if;

  reservation_customer_type := case
    when reservation_user_id is not null then 'member'
    else 'non-member'
  end;

  item_unit_price := case reservation_customer_type
    when 'member' then 15
    else 20
  end;

  insert into public.shirt_reservations (
    user_id,
    full_name,
    email,
    customer_type,
    total_quantity,
    total_price_eur
  )
  values (
    reservation_user_id,
    btrim(reservation_full_name),
    lower(btrim(reservation_email)),
    reservation_customer_type,
    order_total_quantity,
    order_total_quantity * item_unit_price
  )
  returning id into created_reservation_id;

  for reservation_item in
    select value
    from jsonb_array_elements(reservation_items)
  loop
    item_color := reservation_item ->> 'color';
    item_size := reservation_item ->> 'size';
    item_quantity := (reservation_item ->> 'quantity')::integer;

    insert into public.shirt_reservation_items (
      reservation_id,
      color,
      size,
      quantity,
      unit_price_eur
    )
    values (
      created_reservation_id,
      item_color,
      item_size,
      item_quantity,
      item_unit_price
    )
    on conflict (reservation_id, color, size)
    do update set
      quantity = public.shirt_reservation_items.quantity
        + excluded.quantity;
  end loop;

  return created_reservation_id;
end;
$$;

notify pgrst, 'reload schema';
