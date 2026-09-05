-- The storefront only needs the current availability for each variant. Keep
-- the inventory counters and initial quantities private to stock admins.
grant select (color, size, available_quantity)
  on table public.shirt_stock
  to anon, authenticated;

drop policy if exists shirt_stock_select_storefront
  on public.shirt_stock;

create policy shirt_stock_select_storefront
  on public.shirt_stock
  for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
