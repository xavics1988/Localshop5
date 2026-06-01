-- ============================================================
-- 021 — Corrección fórmulas devolución + tabla mediaciones
-- ============================================================
-- • Añade customer_delivery_fee a orders (€4.50 o €0 según umbral)
-- • Añade stripe_refund_id a return_requests
-- • Actualiza place_order para guardar customer_delivery_fee
-- • Corrige resolve_return:
--     desistimiento → reembolso = solo productos
--     error_tara    → reembolso = total completo (incluye fee LocalShop)
-- • Crea tabla mediations (se crea cuando colaborador rechaza)
-- ============================================================

-- 1. Nuevas columnas ─────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_delivery_fee numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE return_requests
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

-- 2. Actualizar place_order con customer_delivery_fee ────────
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
  p_customer_delivery_fee numeric DEFAULT 0
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
    destination_iban, store_id, status, history
  ) VALUES (
    p_order_id, p_customer_id, p_customer_name, p_items, p_total,
    p_shipping_fee, v_fee_base, v_fee_iva, p_customer_delivery_fee,
    p_destination_iban, v_store_id, 'Nuevo',
    jsonb_build_array(jsonb_build_object(
      'date',   now()::text,
      'status', 'Nuevo',
      'label',  'Pedido Realizado'
    ))
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

-- 3. Tabla mediaciones ───────────────────────────────────────
-- Se crea automáticamente cuando el colaborador rechaza una devolución.
-- LocalShop interviene como árbitro.
CREATE TABLE IF NOT EXISTS mediations (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id           uuid          NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  order_id            text          NOT NULL REFERENCES orders(id),
  customer_id         uuid          NOT NULL REFERENCES profiles(id),
  collaborator_id     uuid          NOT NULL REFERENCES profiles(id),
  status              text          NOT NULL DEFAULT 'pendiente'
                                    CHECK (status IN ('pendiente', 'resuelto')),
  customer_reason     text,
  admin_notes         text,
  resolution          text          CHECK (resolution IN ('favor_cliente', 'favor_colaborador', NULL)),
  admin_refund_amount numeric(10,2),
  created_at          timestamptz   DEFAULT now(),
  resolved_at         timestamptz
);

ALTER TABLE mediations ENABLE ROW LEVEL SECURITY;

-- Los participantes pueden ver sus propias mediaciones
DROP POLICY IF EXISTS "mediations_participants_select" ON mediations;
CREATE POLICY "mediations_participants_select" ON mediations
  FOR SELECT USING (auth.uid() IN (customer_id, collaborator_id));

-- 4. Corregir resolve_return ─────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_return(p_return_id uuid, p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_return  return_requests%ROWTYPE;
  v_order   orders%ROWTYPE;
  v_refund  numeric;
  v_charge  numeric;
  v_label   text;
BEGIN
  SELECT * INTO v_return FROM return_requests WHERE id = p_return_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de devolución no encontrada';
  END IF;
  IF v_return.collaborator_id != auth.uid() THEN
    RAISE EXCEPTION 'Solo el colaborador puede resolver la disputa';
  END IF;
  IF v_return.status != 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud no está en estado pendiente';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_return.order_id;

  IF p_decision = 'acordado' THEN

    IF v_return.type = 'error_tara' THEN
      -- Culpa del colaborador → reembolso total (productos + fee LocalShop + envío original)
      v_refund := v_order.total;
      v_charge := v_return.return_shipping_cost;
      v_label  := 'Error/Tara Acordado – Reembolso en Curso';
    ELSE
      -- Desistimiento → reembolso del precio del producto únicamente.
      -- El envío de retorno NO se descuenta: el cliente lo paga directamente
      -- en la empresa de transporte fuera de la app.
      v_refund := GREATEST(
        v_order.total
          - COALESCE(v_order.shipping_fee, 0)
          - COALESCE(v_order.customer_delivery_fee, 0),
        0
      );
      v_charge := 0;
      v_label  := 'Devolución por Desistimiento Acordada';
    END IF;

    UPDATE return_requests SET
      status              = 'acordado',
      refund_amount       = v_refund,
      collaborator_charge = v_charge,
      resolved_at         = now()
    WHERE id = p_return_id;

    UPDATE orders SET
      status  = 'Devolución Solicitada',
      history = history || jsonb_build_array(jsonb_build_object(
        'date',   to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'status', 'Devolución Solicitada',
        'label',  v_label
      ))
    WHERE id = v_return.order_id;

  ELSIF p_decision = 'rechazado' THEN

    UPDATE return_requests SET
      status      = 'rechazado',
      resolved_at = now()
    WHERE id = p_return_id;

    -- Crear mediación para que LocalShop intervenga como árbitro
    INSERT INTO mediations (
      return_id, order_id, customer_id, collaborator_id, customer_reason
    ) VALUES (
      p_return_id,
      v_return.order_id,
      v_return.customer_id,
      v_return.collaborator_id,
      v_return.reason
    );

  ELSE
    RAISE EXCEPTION 'Decisión inválida: %', p_decision;
  END IF;
END;
$$;
