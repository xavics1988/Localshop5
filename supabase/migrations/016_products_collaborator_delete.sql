-- ============================================================
-- MIGRACIÓN 016: Permitir a colaboradores hacer soft-delete
-- de productos de su tienda (is_deleted = true via UPDATE).
-- ============================================================

drop policy if exists "products: store owner actualiza" on products;

create policy "products: store owner o colaborador actualiza"
  on products for update
  using (
    exists (
      select 1 from stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.store_id = store_id
        and p.role = 'colaborador'
    )
  );
