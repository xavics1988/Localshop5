-- ============================================================
-- 024 — Sendcloud: direcciones estructuradas + tracking
-- ============================================================
-- • Dirección estructurada en stores (origen del envío)
-- • Dirección de entrega en orders (destino del envío)
-- • Campos de tracking en orders (envío saliente)
-- • Campos de etiqueta en return_requests (envío retorno)
-- ============================================================

-- 1. Dirección estructurada en stores ────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS address_street      text,
  ADD COLUMN IF NOT EXISTS address_number      text,
  ADD COLUMN IF NOT EXISTS address_postal_code text,
  ADD COLUMN IF NOT EXISTS address_city        text,
  ADD COLUMN IF NOT EXISTS address_province    text,
  ADD COLUMN IF NOT EXISTS address_country     text DEFAULT 'ES';

-- 2. Dirección de entrega en orders ──────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_name          text,
  ADD COLUMN IF NOT EXISTS shipping_street        text,
  ADD COLUMN IF NOT EXISTS shipping_number        text,
  ADD COLUMN IF NOT EXISTS shipping_postal_code   text,
  ADD COLUMN IF NOT EXISTS shipping_city          text,
  ADD COLUMN IF NOT EXISTS shipping_province      text,
  ADD COLUMN IF NOT EXISTS shipping_country       text DEFAULT 'ES',
  ADD COLUMN IF NOT EXISTS shipping_phone         text;

-- 3. Tracking envío saliente en orders ───────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sendcloud_parcel_id  bigint,
  ADD COLUMN IF NOT EXISTS shipping_label_url   text,
  ADD COLUMN IF NOT EXISTS tracking_number      text,
  ADD COLUMN IF NOT EXISTS carrier              text,
  ADD COLUMN IF NOT EXISTS shipping_label_cost  numeric(10,2);

-- 4. Etiqueta retorno en return_requests ─────────────────────
ALTER TABLE return_requests
  ADD COLUMN IF NOT EXISTS sendcloud_return_id    bigint,
  ADD COLUMN IF NOT EXISTS return_label_url       text,
  ADD COLUMN IF NOT EXISTS return_tracking_number text,
  ADD COLUMN IF NOT EXISTS return_carrier         text,
  ADD COLUMN IF NOT EXISTS return_label_cost      numeric(10,2);

-- 5. Helper para añadir eventos al historial de pedidos ──────
CREATE OR REPLACE FUNCTION append_order_event(
  p_order_id text,
  p_status   text,
  p_label    text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE orders SET
    history = history || jsonb_build_array(jsonb_build_object(
      'date',   to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'status', p_status,
      'label',  p_label
    ))
  WHERE id = p_order_id;
END;
$$;

-- 6. Actualizar place_order con dirección de entrega ─────────
CREATE OR REPLACE FUNCTION place_order(
  p_order_id              text,
  p_customer_id           uuid,
  p_customer_name         text,
  p_items                 jsonb,
  p_total                 numeric,
  p_destination_iban      text,
  p_referred_by           text    DEFAULT NULL,
  p_is_first_purchase     boolean DEFAULT FALSE,
  p_shipping_fee          numeric DEFAULT 3.99,
  p_customer_delivery_fee numeric DEFAULT 0,
  -- Dirección de entrega
  p_shipping_name         text    DEFAULT NULL,
  p_shipping_street       text    DEFAULT NULL,
  p_shipping_number       text    DEFAULT NULL,
  p_shipping_postal_code  text    DEFAULT NULL,
  p_shipping_city         text    DEFAULT NULL,
  p_shipping_province     text    DEFAULT NULL,
  p_shipping_country      text    DEFAULT 'ES',
  p_shipping_phone        text    DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  item        jsonb;
  product_id  text;
  qty         integer;
  variant_key text;
  v_store_id  text;
  v_fee_base  numeric(10,2);
  v_fee_iva   numeric(10,2);
BEGIN
  v_store_id := p_items->0->'product'->>'storeId';
  v_fee_base := round(p_shipping_fee / 1.21, 2);
  v_fee_iva  := round(p_shipping_fee - v_fee_base, 2);

  INSERT INTO orders (
    id, customer_id, customer_name, items, total,
    shipping_fee, fee_base, fee_iva, customer_delivery_fee,
    destination_iban, store_id, status, history,
    shipping_name, shipping_street, shipping_number,
    shipping_postal_code, shipping_city, shipping_province,
    shipping_country, shipping_phone
  ) VALUES (
    p_order_id, p_customer_id, p_customer_name, p_items, p_total,
    p_shipping_fee, v_fee_base, v_fee_iva, p_customer_delivery_fee,
    p_destination_iban, v_store_id, 'Nuevo',
    jsonb_build_array(jsonb_build_object(
      'date',   now()::text,
      'status', 'Nuevo',
      'label',  'Pedido Realizado'
    )),
    p_shipping_name, p_shipping_street, p_shipping_number,
    p_shipping_postal_code, p_shipping_city, p_shipping_province,
    p_shipping_country, p_shipping_phone
  );

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    product_id  := item->'product'->>'id';
    qty         := (item->>'quantity')::integer;
    variant_key := item->>'variant';

    UPDATE products SET
      stock = greatest(0, stock - qty),
      stock_per_size = CASE
        WHEN variant_key IS NOT NULL AND variant_key != 'null' AND stock_per_size ? variant_key
        THEN jsonb_set(
          stock_per_size,
          array[variant_key],
          to_jsonb(greatest(0, (stock_per_size->>variant_key)::integer - qty))
        )
        ELSE stock_per_size
      END
    WHERE id = product_id;
  END LOOP;

  IF p_is_first_purchase AND p_referred_by IS NOT NULL AND p_referred_by != '' THEN
    PERFORM increment_referral_balance(p_referred_by, 2);
  END IF;
END;
$$;
