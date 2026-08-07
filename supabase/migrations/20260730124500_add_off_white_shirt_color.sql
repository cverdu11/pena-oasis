alter table public.shirt_reservation_items
  drop constraint if exists shirt_reservation_items_color_check;

alter table public.shirt_reservation_items
  add constraint shirt_reservation_items_color_check
  check (color in ('white', 'off_white', 'blue'));

create or replace function private.validate_shirt_reservation_items(
  reservation_items_arg jsonb
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  reservation_item jsonb;
  item_color text;
  item_size text;
  item_quantity integer;
  order_total_quantity integer := 0;
begin
  if reservation_items_arg is null
    or jsonb_typeof(reservation_items_arg) <> 'array'
  then
    raise exception 'Reservation items must be an array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(reservation_items_arg) not between 1 and 10 then
    raise exception 'A reservation requires between 1 and 10 item lines'
      using errcode = '22023';
  end if;

  for reservation_item in
    select value
    from jsonb_array_elements(reservation_items_arg)
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
      or item_color not in ('white', 'off_white', 'blue')
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

  return order_total_quantity;
end;
$$;

revoke all on function private.validate_shirt_reservation_items(jsonb)
  from public;

notify pgrst, 'reload schema';
