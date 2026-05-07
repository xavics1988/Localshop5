-- ============================================================
-- MIGRACIÓN 010: Unicidad de tienda por propietario
-- Un colaborador solo puede tener una tienda.
-- Elimina duplicados conservando el registro más antiguo.
-- ============================================================

-- Borrar tiendas duplicadas (misma owner_id), conservar la más antigua
delete from stores
where id in (
  select id from (
    select id,
           row_number() over (partition by owner_id order by id) as rn
    from stores
    where owner_id is not null
  ) ranked
  where rn > 1
);

-- Añadir constraint única
alter table stores
  add constraint stores_owner_id_unique unique (owner_id);
