-- Registers an owner-entered return and restores exactly the returned units.

create or replace function public.register_external_shirt_return(
  return_label_arg text,
  return_items_arg jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  return_item record;
  return_label text;
begin
  if auth.uid() is null or not private.is_shirt_stock_admin() then
    raise exception 'Shirt stock administrator access is required'
      using errcode = '42501';
  end if;

  return_label := coalesce(nullif(btrim(return_label_arg), ''), 'Devolución');

  if char_length(return_label) not between 2 and 100 then
    raise exception 'The return label must contain between 2 and 100 characters'
      using errcode = '22023';
  end if;

  perform private.validate_shirt_reservation_items(return_items_arg);

  for return_item in
    select
      item.color,
      item.size,
      item.quantity,
      stock.fulfilled_quantity
    from pg_catalog.jsonb_to_recordset(return_items_arg) as item(
      color text,
      size text,
      quantity integer
    )
    join public.shirt_stock as stock
      on stock.color = item.color
      and stock.size = item.size
    order by stock.color, stock.size
    for update of stock
  loop
    if return_item.fulfilled_quantity < return_item.quantity then
      raise exception 'Cannot return more units than have been fulfilled for % / %',
        return_item.color,
        return_item.size
        using errcode = '23514';
    end if;

    update public.shirt_stock
    set
      fulfilled_quantity = fulfilled_quantity - return_item.quantity,
      updated_at = now()
    where color = return_item.color
      and size = return_item.size;
  end loop;
end;
$$;

revoke all on function public.register_external_shirt_return(text, jsonb)
  from public;
revoke all on function public.register_external_shirt_return(text, jsonb)
  from anon;
grant execute on function public.register_external_shirt_return(text, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
