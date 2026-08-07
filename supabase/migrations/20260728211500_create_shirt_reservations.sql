create table if not exists public.shirt_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null
    check (
      full_name = btrim(full_name)
      and char_length(full_name) between 2 and 100
    ),
  email text not null
    check (
      email = lower(btrim(email))
      and char_length(email) between 5 and 254
      and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  customer_type text not null
    check (customer_type in ('member', 'non-member')),
  total_quantity smallint not null
    check (total_quantity between 1 and 20),
  total_price_eur smallint not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'fulfilled')),
  created_at timestamptz not null default now(),
  constraint shirt_reservations_valid_total_price
    check (
      total_price_eur = total_quantity * (
        case customer_type
          when 'member' then 15
          else 20
        end
      )
    )
);

comment on table public.shirt_reservations is
  'Public shirt reservation orders. Contact data is stored once per order.';

create table if not exists public.shirt_reservation_items (
  id bigint generated always as identity primary key,
  reservation_id uuid not null
    references public.shirt_reservations (id) on delete cascade,
  color text not null
    check (color in ('white', 'blue')),
  size text not null
    check (size in ('S', 'M', 'L', 'XL', '2XL')),
  quantity smallint not null
    check (quantity between 1 and 20),
  unit_price_eur smallint not null
    check (unit_price_eur in (15, 20)),
  created_at timestamptz not null default now(),
  constraint shirt_reservation_items_unique_variant
    unique (reservation_id, color, size)
);

comment on table public.shirt_reservation_items is
  'Color, size and quantity lines belonging to a shirt reservation order.';

create index if not exists shirt_reservations_created_at_idx
  on public.shirt_reservations (created_at desc);

create index if not exists shirt_reservations_status_created_at_idx
  on public.shirt_reservations (status, created_at desc);

create index if not exists shirt_reservations_user_id_idx
  on public.shirt_reservations (user_id)
  where user_id is not null;

alter table public.shirt_reservations enable row level security;
alter table public.shirt_reservation_items enable row level security;

revoke all on table public.shirt_reservations from public;
revoke all on table public.shirt_reservations from anon;
revoke all on table public.shirt_reservations from authenticated;
revoke all on table public.shirt_reservation_items from public;
revoke all on table public.shirt_reservation_items from anon;
revoke all on table public.shirt_reservation_items from authenticated;

drop function if exists public.create_shirt_reservation(
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.create_shirt_reservation(
  text,
  text,
  text,
  jsonb
);

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
  reservation_id uuid;
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
  returning id into reservation_id;

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
      reservation_id,
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

  return reservation_id;
end;
$$;

revoke all on function public.create_shirt_reservation(
  text,
  text,
  jsonb
) from public;

grant execute on function public.create_shirt_reservation(
  text,
  text,
  jsonb
) to anon, authenticated;
