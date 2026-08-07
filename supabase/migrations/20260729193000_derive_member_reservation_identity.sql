create or replace function public.create_shirt_reservation(
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
  resolved_email text;
  resolved_full_name text;
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

  if reservation_user_id is not null then
    select
      lower(account.email),
      coalesce(
        nullif(btrim(profile.full_name), ''),
        nullif(
          btrim(
            pg_catalog.concat_ws(
              ' ',
              profile.first_name,
              profile.last_name
            )
          ),
          ''
        ),
        nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
        'Socio Oasis'
      )
    into resolved_email, resolved_full_name
    from auth.users as account
    left join public.profiles as profile
      on profile.id = account.id
    where account.id = reservation_user_id;

    if not found or resolved_email is null then
      raise exception 'Authenticated member account not found'
        using errcode = '42501';
    end if;
  else
    resolved_email := lower(btrim(reservation_email));
    resolved_full_name := btrim(reservation_full_name);
  end if;

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
    resolved_full_name,
    resolved_email,
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

notify pgrst, 'reload schema';
