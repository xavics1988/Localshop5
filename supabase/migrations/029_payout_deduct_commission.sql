-- ============================================================
-- 029 — Payout quincenal: deducir comisión LocalShop (10%)
-- ============================================================
-- Consolida todos los cambios anteriores de generate_weekly_payouts:
--   · Periodos de 15 días (migración 012)
--   · Excluir sub_orders con stripe_transfer_id (migración 023)
--   · Descontar collaborator_charge de devoluciones (migración 017,
--     perdido en 023)
--   · NUEVO: neto = subtotal − fee_total (= 90% del producto)
--     Los colaboradores con Connect ya reciben 90% vía Stripe.
--     Los colaboradores sin Connect cobran por IBAN y deben
--     recibir también solo el 90%.
-- ============================================================

CREATE OR REPLACE FUNCTION generate_weekly_payouts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period_end   timestamptz := date_trunc('day', now());
  v_period_start timestamptz := v_period_end - interval '15 days';
  rec            record;
  v_amount       numeric(10,2);
  v_charges      numeric(10,2);
  v_iban         text;
  v_store_id     text;
BEGIN
  FOR rec IN
    SELECT DISTINCT i.recipient_id AS seller_id
      FROM invoices i
     WHERE i.recipient_type = 'collaborator'
       AND i.issued_at      >= v_period_start
       AND i.issued_at      <  v_period_end
       -- Excluir facturas ya pagadas automáticamente por Stripe Connect
       AND NOT EXISTS (
         SELECT 1 FROM sub_orders so
          WHERE so.id = i.sub_order_id
            AND so.stripe_transfer_id IS NOT NULL
       )
  LOOP
    -- Neto = 90% del subtotal (10% de comisión LocalShop)
    -- Se usa subtotal * 0.90 en lugar de subtotal - fee_total porque en pedidos
    -- multi-tienda fee_total almacena la comisión total del pedido, no la
    -- porción proporcional de cada sub_order. Consistente con el cálculo de
    -- create-multistore-transfers (sub.subtotal * 0.90).
    SELECT COALESCE(SUM(i.subtotal * 0.90), 0)
      INTO v_amount
      FROM invoices i
     WHERE i.recipient_id   = rec.seller_id
       AND i.recipient_type = 'collaborator'
       AND i.issued_at      >= v_period_start
       AND i.issued_at      <  v_period_end
       AND NOT EXISTS (
         SELECT 1 FROM sub_orders so
          WHERE so.id = i.sub_order_id
            AND so.stripe_transfer_id IS NOT NULL
       );

    -- Descontar cargos por devoluciones error_tara del colaborador en el periodo
    SELECT COALESCE(SUM(rr.collaborator_charge), 0)
      INTO v_charges
      FROM return_requests rr
     WHERE rr.collaborator_id = rec.seller_id
       AND rr.type            = 'error_tara'
       AND rr.status          IN ('acordado', 'completado')
       AND rr.resolved_at    >= v_period_start
       AND rr.resolved_at    <  v_period_end;

    IF GREATEST(v_amount - v_charges, 0) > 0 THEN
      SELECT
        COALESCE(
          (SELECT iban FROM bank_accounts WHERE user_id = rec.seller_id AND is_default = true LIMIT 1),
          (SELECT iban FROM stores WHERE owner_id = rec.seller_id LIMIT 1)
        ),
        (SELECT id FROM stores WHERE owner_id = rec.seller_id LIMIT 1)
      INTO v_iban, v_store_id;

      INSERT INTO payouts (
        seller_id, store_id, period_start, period_end,
        gross_amount, status, iban
      ) VALUES (
        rec.seller_id, v_store_id, v_period_start, v_period_end,
        GREATEST(v_amount - v_charges, 0), 'pending', v_iban
      );
    END IF;
  END LOOP;
END;
$$;
