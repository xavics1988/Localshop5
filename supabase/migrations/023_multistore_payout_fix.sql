-- ============================================================
-- 023 — Excluir sub_orders ya transferidos del payout quincenal
-- ============================================================
-- Los sub_orders de pedidos multi-tienda con Connect onboarded
-- reciben su transfer automáticamente vía stripe-webhook.
-- El payout quincenal no debe incluirlos para evitar doble pago.
-- ============================================================

CREATE OR REPLACE FUNCTION generate_weekly_payouts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period_end   timestamptz := date_trunc('week', now());
  v_period_start timestamptz := v_period_end - interval '7 days';
  rec            record;
  v_amount       numeric(10,2);
  v_iban         text;
  v_store_id     text;
BEGIN
  FOR rec IN
    SELECT DISTINCT i.recipient_id AS seller_id
      FROM invoices i
     WHERE i.recipient_type = 'collaborator'
       AND i.issued_at      >= v_period_start
       AND i.issued_at      <  v_period_end
       -- Excluir facturas de sub_orders que ya tienen transfer de Stripe
       AND NOT EXISTS (
         SELECT 1 FROM sub_orders so
          WHERE so.id = i.sub_order_id
            AND so.stripe_transfer_id IS NOT NULL
       )
  LOOP
    SELECT COALESCE(SUM(i.subtotal), 0)
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

    IF v_amount > 0 THEN
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
        v_amount, 'pending', v_iban
      );
    END IF;
  END LOOP;
END;
$$;
