-- ============================================================
-- 022 — Pedidos Multi-Tienda
-- ============================================================
-- Estructura:
--   orders (pedido padre — factura única al cliente)
--     └── sub_orders (uno por tienda — factura al colaborador)
--
-- Flujo de pago multi-tienda:
--   • El PaymentIntent NO usa transfer_data (sin storeId en create-payment-intent)
--   • Al recibir payment_intent.succeeded, el webhook crea un Transfer de Stripe
--     por sub_order.subtotal a cada tienda con Connect onboarded
--   • stripe_transfer_id registra el transfer — el payout quincenal excluye
--     sub_orders ya transferidos para evitar doble pago
--   • Tiendas sin Connect quedan pendientes del ciclo de payout quincenal
--
-- Flujo de devoluciones multi-tienda:
--   • return_requests referencia sub_order_id (devolucion por tienda)
--   • El reembolso es proporcional al sub_order devuelto
-- ============================================================

-- 1. Tabla sub_orders ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_orders (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_order_id    text          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id           text          REFERENCES stores(id),
  collaborator_id    uuid          REFERENCES profiles(id),
  items              jsonb         NOT NULL DEFAULT '[]',
  subtotal           numeric(10,2) NOT NULL,
  shipping_fee       numeric(10,2) NOT NULL DEFAULT 0,
  stripe_transfer_id text,
  status             text          NOT NULL DEFAULT 'Nuevo'
                                   CHECK (status IN (
                                     'Nuevo','En Proceso','Completado',
                                     'Devolución Solicitada','Devuelto','Cancelado'
                                   )),
  history         jsonb         NOT NULL DEFAULT '[]',
  created_at      timestamptz   DEFAULT now()
);

ALTER TABLE sub_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_orders_customer_select" ON sub_orders;
CREATE POLICY "sub_orders_customer_select" ON sub_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = sub_orders.parent_order_id
        AND orders.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sub_orders_collaborator_select" ON sub_orders;
CREATE POLICY "sub_orders_collaborator_select" ON sub_orders
  FOR SELECT USING (collaborator_id = auth.uid());

DROP POLICY IF EXISTS "sub_orders_collaborator_update" ON sub_orders;
CREATE POLICY "sub_orders_collaborator_update" ON sub_orders
  FOR UPDATE USING (collaborator_id = auth.uid());

-- 2. Vincular return_requests a sub_orders (opcional) ────────
ALTER TABLE return_requests
  ADD COLUMN IF NOT EXISTS sub_order_id uuid REFERENCES sub_orders(id);

-- 3. Vincular invoices a sub_orders (opcional) ───────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sub_order_id uuid REFERENCES sub_orders(id);

-- 4. Función place_multi_store_order ─────────────────────────
-- p_sub_orders: JSON array de objetos
--   { "store_id": "...", "collaborator_id": "...", "items": [...], "subtotal": 0.00 }
CREATE OR REPLACE FUNCTION place_multi_store_order(
  p_order_id              text,
  p_customer_id           uuid,
  p_customer_name         text,
  p_items                 jsonb,
  p_total                 numeric,
  p_destination_iban      text,
  p_sub_orders            jsonb,
  p_localshop_fee         numeric DEFAULT 3.99,
  p_customer_delivery_fee numeric DEFAULT 0,
  p_referred_by           text    DEFAULT NULL,
  p_is_first_purchase     boolean DEFAULT FALSE
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fee_base  numeric(10,2);
  v_fee_iva   numeric(10,2);
  v_sub       jsonb;
  item        jsonb;
  product_id  text;
  qty         integer;
  variant_key text;
BEGIN
  v_fee_base := round(p_localshop_fee / 1.21, 2);
  v_fee_iva  := round(p_localshop_fee - v_fee_base, 2);

  -- Crear pedido padre (sin store_id — es multi-tienda)
  INSERT INTO orders (
    id, customer_id, customer_name, items, total,
    shipping_fee, fee_base, fee_iva, customer_delivery_fee,
    destination_iban, status, history
  ) VALUES (
    p_order_id, p_customer_id, p_customer_name, p_items, p_total,
    p_localshop_fee, v_fee_base, v_fee_iva, p_customer_delivery_fee,
    p_destination_iban, 'Nuevo',
    jsonb_build_array(jsonb_build_object(
      'date',   now()::text,
      'status', 'Nuevo',
      'label',  'Pedido Multi-Tienda Realizado'
    ))
  );

  -- Crear sub-pedidos por tienda
  FOR v_sub IN SELECT * FROM jsonb_array_elements(p_sub_orders) LOOP
    INSERT INTO sub_orders (
      parent_order_id, store_id, collaborator_id,
      items, subtotal, shipping_fee, status, history
    ) VALUES (
      p_order_id,
      (v_sub->>'store_id'),
      (v_sub->>'collaborator_id')::uuid,
      v_sub->'items',
      (v_sub->>'subtotal')::numeric,
      COALESCE((v_sub->>'shipping_fee')::numeric, 0),
      'Nuevo',
      jsonb_build_array(jsonb_build_object(
        'date',   now()::text,
        'status', 'Nuevo',
        'label',  'Sub-pedido Creado'
      ))
    );
  END LOOP;

  -- Decrementar stock de todos los productos
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

-- 5. Función generate_sub_order_invoices ─────────────────────
-- Genera una factura al cliente (pedido completo) y una por cada sub_order (colaborador).
CREATE OR REPLACE FUNCTION generate_multi_store_invoices(p_order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order     orders%ROWTYPE;
  v_customer  profiles%ROWTYPE;
  v_sub       sub_orders%ROWTYPE;
  v_store     stores%ROWTYPE;
  v_subtotal  numeric(10,2);
BEGIN
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id AND sub_order_id IS NULL) THEN
    RETURN; -- factura de cliente ya existe
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_customer FROM profiles WHERE id = v_order.customer_id;

  -- Factura global al CLIENTE (todos los items)
  v_subtotal := v_order.total
                - COALESCE(v_order.shipping_fee, 0)
                - COALESCE(v_order.customer_delivery_fee, 0);

  INSERT INTO invoices (
    order_id, recipient_type, recipient_id, invoice_number,
    customer_name, customer_email,
    subtotal, fee_base, fee_iva, fee_total, total,
    items, issued_at
  ) VALUES (
    p_order_id, 'customer', v_order.customer_id, next_invoice_number(),
    v_customer.name, v_customer.email,
    v_subtotal,
    v_order.fee_base, v_order.fee_iva,
    COALESCE(v_order.shipping_fee, 0),
    v_order.total,
    v_order.items, now()
  );

  -- Una factura por COLABORADOR (solo sus items del sub_order)
  FOR v_sub IN SELECT * FROM sub_orders WHERE parent_order_id = p_order_id LOOP
    IF v_sub.collaborator_id IS NULL THEN CONTINUE; END IF;

    SELECT * INTO v_store FROM stores WHERE id = v_sub.store_id;

    INSERT INTO invoices (
      order_id, sub_order_id, recipient_type, recipient_id, invoice_number,
      store_id, store_name, store_cif, store_address,
      customer_name, customer_email,
      subtotal, fee_base, fee_iva, fee_total, total,
      items, issued_at
    ) VALUES (
      p_order_id, v_sub.id, 'collaborator', v_sub.collaborator_id, next_invoice_number(),
      v_sub.store_id, v_store.name, v_store.cif, v_store.address,
      v_customer.name, v_customer.email,
      v_sub.subtotal,
      v_order.fee_base, v_order.fee_iva,
      COALESCE(v_order.shipping_fee, 0),
      v_sub.subtotal + COALESCE(v_order.shipping_fee, 0),
      v_sub.items, now()
    );
  END LOOP;
END;
$$;
