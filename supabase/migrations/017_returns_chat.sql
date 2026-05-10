-- ============================================================
-- MIGRACIÓN 017: Sistema de devoluciones tipadas + chat privado
-- Dos categorías:
--   desistimiento → cliente paga envío de vuelta (4.50€ fijos)
--   error_tara    → colaborador paga todo, 100% reembolso al cliente
-- ============================================================

-- ── 1. Tabla return_requests ─────────────────────────────────
CREATE TABLE IF NOT EXISTS return_requests (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             text        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id          uuid        NOT NULL REFERENCES profiles(id),
  collaborator_id      uuid        NOT NULL REFERENCES profiles(id),
  type                 text        NOT NULL CHECK (type IN ('desistimiento', 'error_tara')),
  reason               text        NOT NULL,
  status               text        NOT NULL DEFAULT 'pendiente'
                                   CHECK (status IN ('pendiente', 'acordado', 'rechazado', 'completado')),
  return_shipping_cost numeric     NOT NULL DEFAULT 4.50,
  refund_amount        numeric,
  collaborator_charge  numeric,
  resolved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

-- Ambas partes pueden leer sus propias solicitudes
CREATE POLICY "return_requests: partes pueden ver"
  ON return_requests FOR SELECT
  USING (customer_id = auth.uid() OR collaborator_id = auth.uid());

-- Solo el cliente puede crear la solicitud
CREATE POLICY "return_requests: cliente puede crear"
  ON return_requests FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Solo el colaborador puede actualizar (resolver) la solicitud
CREATE POLICY "return_requests: colaborador puede actualizar"
  ON return_requests FOR UPDATE
  USING (collaborator_id = auth.uid());

-- ── 2. Tabla return_messages ─────────────────────────────────
CREATE TABLE IF NOT EXISTS return_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id  uuid        NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES profiles(id),
  body       text,
  image_url  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_or_image CHECK (body IS NOT NULL OR image_url IS NOT NULL)
);

ALTER TABLE return_messages ENABLE ROW LEVEL SECURITY;

-- Solo las partes del return pueden ver los mensajes
CREATE POLICY "return_messages: partes pueden ver"
  ON return_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM return_requests rr
      WHERE rr.id = return_id
        AND (rr.customer_id = auth.uid() OR rr.collaborator_id = auth.uid())
    )
  );

-- Solo las partes del return pueden enviar mensajes (y deben ser el sender)
CREATE POLICY "return_messages: partes pueden insertar"
  ON return_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM return_requests rr
      WHERE rr.id = return_id
        AND (rr.customer_id = auth.uid() OR rr.collaborator_id = auth.uid())
    )
  );

-- ── 3. Realtime ───────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE return_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE return_messages;

-- ── 4. RPC: resolve_return ────────────────────────────────────
-- Solo el colaborador puede llamar a esta función.
-- 'acordado': calcula reembolso y carga, actualiza pedido a 'Devolución Solicitada'.
-- 'rechazado': cierra la disputa sin cambios en el pedido.
CREATE OR REPLACE FUNCTION resolve_return(p_return_id uuid, p_decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      v_refund := v_order.total;
      v_charge := v_return.return_shipping_cost;
      v_label  := 'Error/Tara Acordado – Devolución en Curso';
    ELSE
      v_refund := v_order.total - v_return.return_shipping_cost;
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
      history = history || jsonb_build_array(
        jsonb_build_object(
          'date',   to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'status', 'Devolución Solicitada',
          'label',  v_label
        )
      )
    WHERE id = v_return.order_id;

  ELSIF p_decision = 'rechazado' THEN
    UPDATE return_requests SET
      status      = 'rechazado',
      resolved_at = now()
    WHERE id = p_return_id;

  ELSE
    RAISE EXCEPTION 'Decisión inválida: %', p_decision;
  END IF;
END;
$$;

-- ── 5. Deducción de cargos de devolución en payouts ──────────
-- Actualizar generate_weekly_payouts para descontar collaborator_charge
-- de returns error_tara completados/acordados dentro del periodo.
CREATE OR REPLACE FUNCTION generate_weekly_payouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec          RECORD;
  v_period_end timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC');
  v_period_start timestamptz := v_period_end - INTERVAL '15 days';
  v_iban       text;
  v_charges    numeric;
BEGIN
  FOR rec IN
    SELECT
      i.recipient_id AS seller_id,
      i.store_id,
      SUM(i.subtotal) AS gross
    FROM invoices i
    WHERE
      i.recipient_type = 'collaborator'
      AND i.issued_at >= v_period_start
      AND i.issued_at <  v_period_end
    GROUP BY i.recipient_id, i.store_id
  LOOP
    -- No generar payout duplicado para el mismo periodo
    IF EXISTS (
      SELECT 1 FROM payouts
      WHERE seller_id    = rec.seller_id
        AND period_start = v_period_start
        AND period_end   = v_period_end
    ) THEN
      CONTINUE;
    END IF;

    -- IBAN: primero cuenta bancaria por defecto, luego IBAN de la tienda
    SELECT ba.iban INTO v_iban
    FROM bank_accounts ba
    WHERE ba.user_id = rec.seller_id AND ba.is_default = true
    LIMIT 1;

    IF v_iban IS NULL THEN
      SELECT s.iban INTO v_iban
      FROM stores s
      WHERE s.id = rec.store_id
      LIMIT 1;
    END IF;

    -- Suma de cargos por devoluciones error_tara resueltas en el periodo
    SELECT COALESCE(SUM(rr.collaborator_charge), 0) INTO v_charges
    FROM return_requests rr
    WHERE rr.collaborator_id = rec.seller_id
      AND rr.type            = 'error_tara'
      AND rr.status          IN ('acordado', 'completado')
      AND rr.resolved_at    >= v_period_start
      AND rr.resolved_at    <  v_period_end;

    INSERT INTO payouts (
      seller_id, store_id,
      period_start, period_end,
      gross_amount, status, iban
    ) VALUES (
      rec.seller_id, rec.store_id,
      v_period_start, v_period_end,
      GREATEST(rec.gross - v_charges, 0), 'pending', v_iban
    );
  END LOOP;
END;
$$;

-- ── NOTA: Supabase Storage ────────────────────────────────────
-- Crear manualmente el bucket 'return-evidence' en el Dashboard:
--   Storage → New bucket → Name: return-evidence → Private (no public)
-- Policies necesarias (via Dashboard o SQL en storage schema):
--   SELECT: auth.uid() is participant in the return_request
--   INSERT: auth.uid() is participant in the return_request AND sender
