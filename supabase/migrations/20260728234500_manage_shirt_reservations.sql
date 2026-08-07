create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

alter table public.shirt_reservations
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version integer not null default 1
    check (version > 0);

update public.shirt_reservations
set updated_at = created_at
where version = 1
  and updated_at > created_at;

create table if not exists public.shirt_reservation_management_tokens (
  id bigint generated always as identity primary key,
  reservation_id uuid not null
    references public.shirt_reservations (id) on delete cascade,
  token_hash text not null unique
    check (char_length(token_hash) = 64),
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shirt_reservation_management_tokens_lookup_idx
  on public.shirt_reservation_management_tokens (
    reservation_id,
    token_hash
  )
  where revoked_at is null;

alter table public.shirt_reservation_management_tokens
  enable row level security;

revoke all on table public.shirt_reservation_management_tokens
  from public;
revoke all on table public.shirt_reservation_management_tokens
  from anon;
revoke all on table public.shirt_reservation_management_tokens
  from authenticated;

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

  return order_total_quantity;
end;
$$;

create or replace function private.replace_shirt_reservation_items(
  reservation_id_arg uuid,
  reservation_items_arg jsonb,
  item_unit_price_arg smallint
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  reservation_item jsonb;
  item_color text;
  item_size text;
  item_quantity integer;
  order_total_quantity integer;
begin
  order_total_quantity :=
    private.validate_shirt_reservation_items(reservation_items_arg);

  delete from public.shirt_reservation_items
  where reservation_id = reservation_id_arg;

  for reservation_item in
    select value
    from jsonb_array_elements(reservation_items_arg)
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
      reservation_id_arg,
      item_color,
      item_size,
      item_quantity,
      item_unit_price_arg
    )
    on conflict (reservation_id, color, size)
    do update set
      quantity = public.shirt_reservation_items.quantity
        + excluded.quantity,
      unit_price_eur = excluded.unit_price_eur;
  end loop;

  return order_total_quantity;
end;
$$;

revoke all on function private.validate_shirt_reservation_items(jsonb)
  from public;
revoke all on function private.replace_shirt_reservation_items(
  uuid,
  jsonb,
  smallint
) from public;

drop policy if exists shirt_reservations_select_own
  on public.shirt_reservations;

create policy shirt_reservations_select_own
  on public.shirt_reservations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists shirt_reservation_items_select_own
  on public.shirt_reservation_items;

create policy shirt_reservation_items_select_own
  on public.shirt_reservation_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.shirt_reservations
      where public.shirt_reservations.id =
        public.shirt_reservation_items.reservation_id
        and public.shirt_reservations.user_id = (select auth.uid())
    )
  );

grant select on table public.shirt_reservations to authenticated;
grant select on table public.shirt_reservation_items to authenticated;

drop function if exists public.create_shirt_reservation(
  text,
  text,
  jsonb
);

create function public.create_shirt_reservation(
  reservation_full_name text,
  reservation_email text,
  reservation_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_reservation_id uuid;
  management_token text;
  order_total_quantity integer;
  reservation_customer_type text;
  reservation_user_id uuid := (select auth.uid());
  item_unit_price smallint;
begin
  order_total_quantity :=
    private.validate_shirt_reservation_items(reservation_items);

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

  perform private.replace_shirt_reservation_items(
    created_reservation_id,
    reservation_items,
    item_unit_price
  );

  if reservation_user_id is null then
    management_token :=
      encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.shirt_reservation_management_tokens (
      reservation_id,
      token_hash
    )
    values (
      created_reservation_id,
      encode(
        extensions.digest(management_token, 'sha256'),
        'hex'
      )
    );
  end if;

  return jsonb_build_object(
    'id',
    created_reservation_id,
    'managementToken',
    management_token
  );
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

create or replace function public.update_my_shirt_reservation(
  reservation_id_arg uuid,
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
  item_unit_price smallint;
  next_version integer;
  order_total_quantity integer;
  reservation_user_id uuid := (select auth.uid());
begin
  if reservation_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select
    status,
    version,
    case customer_type when 'member' then 15 else 20 end
  into current_status, current_version, item_unit_price
  from public.shirt_reservations
  where id = reservation_id_arg
    and user_id = reservation_user_id
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
    item_unit_price
  );

  update public.shirt_reservations
  set
    total_quantity = order_total_quantity,
    total_price_eur = order_total_quantity * item_unit_price,
    updated_at = now(),
    version = public.shirt_reservations.version + 1
  where id = reservation_id_arg
  returning version into next_version;

  return next_version;
end;
$$;

revoke all on function public.update_my_shirt_reservation(
  uuid,
  integer,
  jsonb
) from public;

grant execute on function public.update_my_shirt_reservation(
  uuid,
  integer,
  jsonb
) to authenticated;

create or replace function public.get_guest_shirt_reservation(
  reservation_id_arg uuid,
  management_token_arg text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reservation_result jsonb;
begin
  if management_token_arg is null
    or management_token_arg !~ '^[0-9a-fA-F]{64}$'
  then
    return null;
  end if;

  select jsonb_build_object(
    'createdAt',
    reservation.created_at,
    'customerType',
    reservation.customer_type,
    'id',
    reservation.id,
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'color',
            item.color,
            'quantity',
            item.quantity,
            'size',
            item.size
          )
          order by item.id
        )
        from public.shirt_reservation_items as item
        where item.reservation_id = reservation.id
      ),
      '[]'::jsonb
    ),
    'status',
    reservation.status,
    'totalPriceEur',
    reservation.total_price_eur,
    'totalQuantity',
    reservation.total_quantity,
    'updatedAt',
    reservation.updated_at,
    'version',
    reservation.version
  )
  into reservation_result
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
    );

  return reservation_result;
end;
$$;

revoke all on function public.get_guest_shirt_reservation(
  uuid,
  text
) from public;

grant execute on function public.get_guest_shirt_reservation(
  uuid,
  text
) to anon, authenticated;

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
    20
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
