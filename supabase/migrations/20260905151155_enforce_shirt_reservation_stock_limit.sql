-- Reservations do not consume inventory. This guard only prevents a single
-- reservation line (including duplicate variant lines in the same order) from
-- exceeding the currently available physical stock. Inventory is still
-- deducted exclusively when a reservation becomes fulfilled.

create or replace function private.validate_shirt_reservation_item_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  available_quantity smallint;
  existing_quantity integer;
  requested_quantity integer;
begin
  select stock.available_quantity
  into available_quantity
  from public.shirt_stock as stock
  where stock.color = new.color
    and stock.size = new.size;

  if not found then
    raise exception 'No inventory variant exists for % / %',
      new.color,
      new.size
      using errcode = '23503';
  end if;

  select coalesce(sum(item.quantity), 0)
  into existing_quantity
  from public.shirt_reservation_items as item
  where item.reservation_id = new.reservation_id
    and item.color = new.color
    and item.size = new.size
    and (tg_op <> 'UPDATE' or item.id <> new.id);

  requested_quantity := existing_quantity + new.quantity;

  if requested_quantity > available_quantity then
    raise exception
      'Insufficient inventory for % / %: requested %, available %',
      new.color,
      new.size,
      requested_quantity,
      available_quantity
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_shirt_reservation_item_stock()
  from public;
revoke all on function private.validate_shirt_reservation_item_stock()
  from anon;
revoke all on function private.validate_shirt_reservation_item_stock()
  from authenticated;

drop trigger if exists shirt_reservation_items_validate_stock
  on public.shirt_reservation_items;
create trigger shirt_reservation_items_validate_stock
before insert or update of color, size, quantity
on public.shirt_reservation_items
for each row
execute function private.validate_shirt_reservation_item_stock();

notify pgrst, 'reload schema';
