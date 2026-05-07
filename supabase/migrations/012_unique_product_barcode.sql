-- ============================================================
-- MIGRACIÓN 012: Unicidad de barcode por tienda en products
-- Un mismo código de barras no puede repetirse dentro de la
-- misma tienda. Los duplicados existentes se fusionan antes
-- de añadir el constraint.
-- ============================================================

-- Paso 1: Fusionar stockPerSize de duplicados y conservar el más antiguo
do $$
declare
  rec record;
  keeper_id text;
  merged_stock_per_size jsonb;
  merged_total_stock integer;
begin
  -- Buscar grupos duplicados: mismo store_id + barcode con más de 1 fila activa
  for rec in
    select store_id, barcode
      from products
     where barcode is not null
       and barcode <> ''
       and is_deleted = false
     group by store_id, barcode
    having count(*) > 1
  loop
    -- Elegir el registro más antiguo como el que se conserva
    select id into keeper_id
      from products
     where store_id  = rec.store_id
       and barcode   = rec.barcode
       and is_deleted = false
     order by created_at asc
     limit 1;

    -- Fusionar todos los stockPerSize del grupo en uno
    select coalesce(
      (
        select jsonb_object_agg(key, value::bigint)
          from (
            select key, sum(value::bigint) as value
              from products,
                   jsonb_each_text(coalesce(stock_per_size, '{}'::jsonb))
             where store_id   = rec.store_id
               and barcode    = rec.barcode
               and is_deleted = false
             group by key
          ) agg
      ),
      '{}'::jsonb
    ) into merged_stock_per_size;

    merged_total_stock := (
      select coalesce(sum(value::bigint), 0)
        from jsonb_each_text(merged_stock_per_size)
    );

    -- Actualizar el registro conservado con el stock fusionado
    update products
       set stock_per_size = merged_stock_per_size,
           sizes          = array(select jsonb_object_keys(merged_stock_per_size)),
           stock          = merged_total_stock
     where id = keeper_id;

    -- Marcar el resto como eliminados
    update products
       set is_deleted = true
     where store_id   = rec.store_id
       and barcode    = rec.barcode
       and is_deleted = false
       and id        <> keeper_id;
  end loop;
end;
$$;

-- Paso 2: Añadir constraint única parcial (solo filas activas)
create unique index if not exists products_store_barcode_unique
  on products (store_id, barcode)
  where is_deleted = false and barcode is not null and barcode <> '';
