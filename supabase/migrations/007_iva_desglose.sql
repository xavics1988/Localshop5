-- ------------------------------------------------------------
-- Añade columnas de desglose IVA a orders y actualiza place_order
-- Opción A: LOCALSHOP_FEE (€3.99) ya incluye IVA 21%
--   fee_base = 3.99 / 1.21 = 3.30  (base imponible)
--   fee_iva  = 3.99 - 3.30 = 0.69  (IVA repercutido)
-- ------------------------------------------------------------

alter table orders
  add column if not exists fee_base numeric(10,2),
  add column if not exists fee_iva  numeric(10,2);

-- Rellenar filas existentes con los valores calculados
update orders
set
  fee_base = round(shipping_fee / 1.21, 2),
  fee_iva  = round(shipping_fee - round(shipping_fee / 1.21, 2), 2)
where fee_base is null and shipping_fee is not null;

-- Actualizar place_order para guardar el desglose IVA
create or replace function place_order(
  p_order_id          text,
  p_customer_id       uuid,
  p_customer_name     text,
  p_items             jsonb,
  p_total             numeric,
  p_destination_iban  text,
  p_referred_by       text    default null,
  p_is_first_purchase boolean default false,
  p_shipping_fee      numeric default 3.99
)
returns void language plpgsql security definer as $$
declare
  item        jsonb;
  product_id  text;
  qty         integer;
  variant_key text;
  v_store_id  text;
  v_fee_base  numeric(10,2);
  v_fee_iva   numeric(10,2);
begin
  v_store_id := p_items->0->'product'->>'storeId';
  v_fee_base := round(p_shipping_fee / 1.21, 2);
  v_fee_iva  := round(p_shipping_fee - v_fee_base, 2);

  insert into orders (id, customer_id, customer_name, items, total, shipping_fee, fee_base, fee_iva, destination_iban, store_id, status, history)
  values (
    p_order_id,
    p_customer_id,
    p_customer_name,
    p_items,
    p_total,
    p_shipping_fee,
    v_fee_base,
    v_fee_iva,
    p_destination_iban,
    v_store_id,
    'Nuevo',
    jsonb_build_array(jsonb_build_object(
      'date',   now()::text,
      'status', 'Nuevo',
      'label',  'Pedido Realizado'
    ))
  );

  -- Decrementar stock por cada item
  for item in select * from jsonb_array_elements(p_items) loop
    product_id  := item->'product'->>'id';
    qty         := (item->>'quantity')::integer;
    variant_key := item->>'variant';

    update products
    set
      stock = greatest(0, stock - qty),
      stock_per_size = case
        when variant_key is not null and variant_key != 'null' and stock_per_size ? variant_key
        then jsonb_set(
          stock_per_size,
          array[variant_key],
          to_jsonb(greatest(0, (stock_per_size->>variant_key)::integer - qty))
        )
        else stock_per_size
      end
    where id = product_id;
  end loop;

  -- Recompensa de referido: solo en primera compra
  if p_is_first_purchase and p_referred_by is not null and p_referred_by != '' then
    perform increment_referral_balance(p_referred_by, 2);
  end if;
end;
$$;
