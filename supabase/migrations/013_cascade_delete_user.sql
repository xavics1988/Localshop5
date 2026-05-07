-- ============================================================
-- MIGRACIÓN 013: Borrado en cascada completo al eliminar usuario
-- Al borrar un usuario en Auth → profile → todo lo suyo se borra.
-- ============================================================

-- 1. stores.owner_id: SET NULL → CASCADE
--    (borra la tienda y sus productos en cascada)
alter table stores
  drop constraint if exists stores_owner_id_fkey;

alter table stores
  add constraint stores_owner_id_fkey
  foreign key (owner_id) references profiles(id) on delete cascade;

-- 2. payouts.seller_id: sin acción → CASCADE
--    (evita que los pagos pendientes bloqueen el borrado del usuario)
alter table payouts
  drop constraint if exists payouts_seller_id_fkey;

alter table payouts
  add constraint payouts_seller_id_fkey
  foreign key (seller_id) references profiles(id) on delete cascade;

-- 3. reviews.author_id: SET NULL → CASCADE
--    (borra las reseñas del usuario en lugar de dejarlas sin autor)
alter table reviews
  drop constraint if exists reviews_author_id_fkey;

alter table reviews
  add constraint reviews_author_id_fkey
  foreign key (author_id) references profiles(id) on delete cascade;
