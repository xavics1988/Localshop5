-- ============================================================
-- 028 — error_tara: etiqueta primero, reembolso al recibir
-- ============================================================
-- Nueva lógica para devoluciones por error/tara:
--   1. Colaborador acepta → estado "esperando_recepcion"
--      (se genera etiqueta prepagada y se envía al cliente)
--   2. Colaborador confirma recepción del artículo
--      → reembolso 100% al cliente
-- Antes el reembolso era inmediato al aceptar (riesgo de fraude).
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_return(p_return_id uuid, p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_return  return_requests%ROWTYPE;
  v_order   orders%ROWTYPE;
  v_refund  numeric;
  v_charge  numeric;
  v_label   text;
  v_status  text;
BEGIN
  SELECT * INTO v_return FROM return_requests WHERE id = p_return_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de devolución no encontrada';
  END IF;
  IF v_return.collaborator_id != auth.uid() THEN
    RAISE EXCEPTION 'Solo el colaborador puede resolver la disputa';
  END IF;
  IF v_return.status NOT IN ('pendiente') THEN
    RAISE EXCEPTION 'La solicitud no está en estado pendiente';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_return.order_id;

  IF p_decision = 'acordado' THEN

    IF v_return.type = 'error_tara' THEN
      -- Culpa del colaborador → etiqueta prepagada enviada al cliente,
      -- reembolso 100% cuando el colaborador confirme la recepción.
      v_refund  := v_order.total;
      v_charge  := v_return.return_shipping_cost;
      v_label   := 'Error/Tara Acordado – Etiqueta Enviada al Cliente';
      v_status  := 'esperando_recepcion';
    ELSE
      -- Desistimiento → el cliente envía por su cuenta, reembolso al recibir.
      v_refund  := GREATEST(
        v_order.total
          - COALESCE(v_order.shipping_fee, 0)
          - COALESCE(v_order.customer_delivery_fee, 0),
        0
      );
      v_charge  := 0;
      v_label   := 'Devolución por Desistimiento – Pendiente de Recepción';
      v_status  := 'esperando_recepcion';
    END IF;

    UPDATE return_requests SET
      status              = v_status,
      refund_amount       = v_refund,
      collaborator_charge = v_charge,
      resolved_at         = NULL
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
