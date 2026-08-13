-- Shirt inventory is intentionally fixed at 120 units: 30 blue, 60 white,
-- and 30 off_white (five sizes each). Fulfilled reservations are the sole
-- source of fulfilled_quantity; available_quantity is derived from it.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists public.shirt_stock (
  color text not null
    check (color in ('white', 'off_white', 'blue')),
  size text not null
    check (size in ('S', 'M', 'L', 'XL', '2XL')),
  initial_quantity smallint not null
    check (initial_quantity >= 0),
  fulfilled_quantity smallint not null default 0
    check (fulfilled_quantity >= 0)
    check (fulfilled_quantity <= initial_quantity),
  available_quantity smallint generated always as
    (initial_quantity - fulfilled_quantity) stored,
  updated_at timestamptz not null default now(),
  primary key (color, size)
);

comment on table public.shirt_stock is
  'Owner-only shirt inventory. The 15 seed rows total 120 initial units.';

insert into public.shirt_stock (color, size, initial_quantity)
values
  ('blue', 'S', 6),
  ('blue', 'M', 6),
  ('blue', 'L', 6),
  ('blue', 'XL', 6),
  ('blue', '2XL', 6),
  ('white', 'S', 12),
  ('white', 'M', 12),
  ('white', 'L', 12),
  ('white', 'XL', 12),
  ('white', '2XL', 12),
  ('off_white', 'S', 6),
  ('off_white', 'M', 6),
  ('off_white', 'L', 6),
  ('off_white', 'XL', 6),
  ('off_white', '2XL', 6)
on conflict (color, size) do nothing;

do $$
begin
  if (select count(*) from public.shirt_stock) <> 15
    or (select sum(initial_quantity) from public.shirt_stock) <> 120
  then
    raise exception 'Shirt stock must contain exactly 15 variants totaling 120 units'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.shirt_stock enable row level security;

revoke all on table public.shirt_stock from public;
revoke all on table public.shirt_stock from anon;
revoke all on table public.shirt_stock from authenticated;

-- The App Metadata field must be set through the Supabase Dashboard or a
-- service-role-only operation. It is deliberately not read from profiles.
create or replace function private.is_shirt_stock_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'shirt_stock_admin' = 'true',
    false
  );
$$;

revoke all on function private.is_shirt_stock_admin() from public;
revoke all on function private.is_shirt_stock_admin() from anon;
revoke all on function private.is_shirt_stock_admin() from authenticated;

create or replace function private.apply_shirt_stock_change(
  reservation_id_arg uuid,
  fulfilled_delta_arg integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_item record;
  missing_variant boolean;
begin
  if fulfilled_delta_arg not in (-1, 1) then
    raise exception 'Invalid shirt fulfilled quantity delta'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.shirt_reservation_items as item
    left join public.shirt_stock as stock
      on stock.color = item.color
      and stock.size = item.size
    where item.reservation_id = reservation_id_arg
      and stock.color is null
  )
  into missing_variant;

  if missing_variant then
    raise exception 'A reservation item has no inventory variant'
      using errcode = '23503';
  end if;

  -- Lock all affected variants in a stable order before checking or changing
  -- stock. This keeps concurrent fulfillment transactions deadlock-safe.
  for reservation_item in
    select
      stock.color,
      stock.size,
      stock.available_quantity,
      item.quantity
    from public.shirt_reservation_items as item
    join public.shirt_stock as stock
      on stock.color = item.color
      and stock.size = item.size
    where item.reservation_id = reservation_id_arg
    order by stock.color, stock.size
    for update of stock
  loop
    -- +1 enters fulfilled: consume available stock. -1 leaves fulfilled:
    -- restore it. The generated available_quantity follows the counter.
    if fulfilled_delta_arg = 1
      and reservation_item.available_quantity < reservation_item.quantity
    then
      raise exception 'Insufficient inventory for % / %',
        reservation_item.color,
        reservation_item.size
        using errcode = '23514';
    end if;

    update public.shirt_stock
    set
      fulfilled_quantity = fulfilled_quantity
        + (reservation_item.quantity * fulfilled_delta_arg),
      updated_at = now()
    where color = reservation_item.color
      and size = reservation_item.size;
  end loop;
end;
$$;

create or replace function private.apply_shirt_stock_on_fulfillment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'fulfilled' then
    perform private.apply_shirt_stock_change(new.id, 1);
  elsif tg_op = 'UPDATE' then
    if old.status <> 'fulfilled' and new.status = 'fulfilled' then
      perform private.apply_shirt_stock_change(new.id, 1);
    elsif old.status = 'fulfilled' and new.status <> 'fulfilled' then
      perform private.apply_shirt_stock_change(new.id, -1);
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.prevent_direct_fulfilled_reservation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'fulfilled' then
    raise exception
      'Reservations must be inserted as pending or confirmed before fulfillment'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_fulfilled_reservation_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_reservation record;
begin
  -- FOR SHARE serializes item edits with any reservation status update. For an
  -- item moved between reservations, both the source and destination are
  -- checked so a fulfilled source cannot be bypassed.
  if tg_op = 'UPDATE' then
    for checked_reservation in
      select id, status
      from public.shirt_reservations
      where id in (old.reservation_id, new.reservation_id)
      order by id
      for share
    loop
      if checked_reservation.status = 'fulfilled' then
        raise exception 'Fulfilled reservation items are immutable; unfulfill first'
          using errcode = '55000';
      end if;
    end loop;
  else
    for checked_reservation in
      select id, status
      from public.shirt_reservations
      where id = case
        when tg_op = 'DELETE' then old.reservation_id
        else new.reservation_id
      end
      for share
    loop
      if checked_reservation.status = 'fulfilled' then
        raise exception 'Fulfilled reservation items are immutable; unfulfill first'
          using errcode = '55000';
      end if;
    end loop;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function private.prevent_fulfilled_reservation_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'fulfilled' then
    raise exception 'Fulfilled reservations must be unfulfilled before deletion'
      using errcode = '55000';
  end if;

  return old;
end;
$$;

revoke all on function private.apply_shirt_stock_change(uuid, integer) from public;
revoke all on function private.apply_shirt_stock_change(uuid, integer) from anon;
revoke all on function private.apply_shirt_stock_change(uuid, integer) from authenticated;
revoke all on function private.apply_shirt_stock_on_fulfillment() from public;
revoke all on function private.apply_shirt_stock_on_fulfillment() from anon;
revoke all on function private.apply_shirt_stock_on_fulfillment() from authenticated;
revoke all on function private.prevent_direct_fulfilled_reservation_insert() from public;
revoke all on function private.prevent_direct_fulfilled_reservation_insert() from anon;
revoke all on function private.prevent_direct_fulfilled_reservation_insert() from authenticated;
revoke all on function private.prevent_fulfilled_reservation_item_changes() from public;
revoke all on function private.prevent_fulfilled_reservation_item_changes() from anon;
revoke all on function private.prevent_fulfilled_reservation_item_changes() from authenticated;
revoke all on function private.prevent_fulfilled_reservation_delete() from public;
revoke all on function private.prevent_fulfilled_reservation_delete() from anon;
revoke all on function private.prevent_fulfilled_reservation_delete() from authenticated;

-- Reconcile before the transition trigger is installed. The locks keep this
-- snapshot and the initial fulfilled counters in one consistent transaction.
lock table public.shirt_reservations, public.shirt_reservation_items
  in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from (
      select item.color, item.size, sum(item.quantity)::integer as quantity
      from public.shirt_reservation_items as item
      join public.shirt_reservations as reservation
        on reservation.id = item.reservation_id
      where reservation.status = 'fulfilled'
      group by item.color, item.size
    ) as demand
    left join public.shirt_stock as stock
      on stock.color = demand.color
      and stock.size = demand.size
    where stock.color is null
      or demand.quantity > stock.initial_quantity
  ) then
    raise exception 'Existing fulfilled reservations exceed seeded shirt inventory'
      using errcode = '23514';
  end if;
end;
$$;

update public.shirt_stock as stock
set
  fulfilled_quantity = demand.quantity,
  updated_at = now()
from (
  select item.color, item.size, sum(item.quantity)::smallint as quantity
  from public.shirt_reservation_items as item
  join public.shirt_reservations as reservation
    on reservation.id = item.reservation_id
  where reservation.status = 'fulfilled'
  group by item.color, item.size
) as demand
where stock.color = demand.color
  and stock.size = demand.size;

drop trigger if exists shirt_reservations_prevent_direct_fulfilled_insert
  on public.shirt_reservations;
create trigger shirt_reservations_prevent_direct_fulfilled_insert
before insert on public.shirt_reservations
for each row
execute function private.prevent_direct_fulfilled_reservation_insert();

drop trigger if exists shirt_reservations_apply_stock_on_fulfillment
  on public.shirt_reservations;
create trigger shirt_reservations_apply_stock_on_fulfillment
after insert or update of status on public.shirt_reservations
for each row
execute function private.apply_shirt_stock_on_fulfillment();

drop trigger if exists shirt_reservation_items_prevent_fulfilled_changes
  on public.shirt_reservation_items;
create trigger shirt_reservation_items_prevent_fulfilled_changes
before insert or update or delete on public.shirt_reservation_items
for each row
execute function private.prevent_fulfilled_reservation_item_changes();

drop trigger if exists shirt_reservations_prevent_fulfilled_delete
  on public.shirt_reservations;
create trigger shirt_reservations_prevent_fulfilled_delete
before delete on public.shirt_reservations
for each row
execute function private.prevent_fulfilled_reservation_delete();

create or replace function public.get_shirt_stock_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_shirt_stock_admin() then
    raise exception 'Shirt stock administrator access is required'
      using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'stock', coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'color', stock.color,
            'size', stock.size,
            'initialQuantity', stock.initial_quantity,
            'fulfilledQuantity', stock.fulfilled_quantity,
            'availableQuantity', stock.available_quantity,
            'updatedAt', stock.updated_at
          )
          order by stock.color, stock.size
        )
        from public.shirt_stock as stock
      ),
      '[]'::jsonb
    ),
    'reservations', coalesce(
      (
        select pg_catalog.jsonb_agg(reservation_row.payload order by reservation_row.created_at desc)
        from (
          select
            reservation.created_at,
            pg_catalog.jsonb_build_object(
              'id', reservation.id,
              'createdAt', reservation.created_at,
              'fullName', reservation.full_name,
              'email', reservation.email,
              'customerType', reservation.customer_type,
              'status', reservation.status,
              'totalQuantity', reservation.total_quantity,
              'totalPriceEur', reservation.total_price_eur,
              'updatedAt', reservation.updated_at,
              'version', reservation.version,
              'items', coalesce(
                (
                  select pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                      'color', item.color,
                      'size', item.size,
                      'quantity', item.quantity
                    )
                    order by item.color, item.size
                  )
                  from public.shirt_reservation_items as item
                  where item.reservation_id = reservation.id
                ),
                '[]'::jsonb
              )
            ) as payload
          from public.shirt_reservations as reservation
          order by reservation.created_at desc
        ) as reservation_row
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.update_shirt_reservation_status(
  reservation_id_arg uuid,
  expected_version_arg integer,
  next_status_arg text
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
  if auth.uid() is null or not private.is_shirt_stock_admin() then
    raise exception 'Shirt stock administrator access is required'
      using errcode = '42501';
  end if;

  select status, version
  into current_status, current_version
  from public.shirt_reservations
  where id = reservation_id_arg
  for update;

  if not found then
    raise exception 'Reservation not found'
      using errcode = 'P0002';
  end if;

  if expected_version_arg is null
    or current_version <> expected_version_arg
  then
    raise exception 'Reservation has changed'
      using errcode = '40001';
  end if;

  if next_status_arg is null then
    raise exception 'A next reservation status is required'
      using errcode = '22023';
  end if;

  if next_status_arg = current_status then
    return current_version;
  end if;

  if not (
    (current_status = 'pending'
      and next_status_arg in ('confirmed', 'cancelled', 'fulfilled'))
    or (current_status = 'confirmed'
      and next_status_arg in ('cancelled', 'fulfilled'))
    or (current_status = 'fulfilled'
      and next_status_arg in ('confirmed', 'cancelled'))
  ) then
    raise exception 'Invalid reservation status transition'
      using errcode = '22023';
  end if;

  update public.shirt_reservations
  set
    status = next_status_arg,
    updated_at = now(),
    version = public.shirt_reservations.version + 1
  where id = reservation_id_arg
  returning version into next_version;

  return next_version;
end;
$$;

revoke all on function public.get_shirt_stock_dashboard() from public;
revoke all on function public.get_shirt_stock_dashboard() from anon;
revoke all on function public.update_shirt_reservation_status(uuid, integer, text)
  from public;
revoke all on function public.update_shirt_reservation_status(uuid, integer, text)
  from anon;

grant execute on function public.get_shirt_stock_dashboard() to authenticated;
grant execute on function public.update_shirt_reservation_status(uuid, integer, text)
  to authenticated;

notify pgrst, 'reload schema';
