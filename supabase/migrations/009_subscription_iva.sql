-- ============================================================
-- MIGRACIÓN 009: Desglose IVA en suscripciones de colaboradores
-- Las cuotas mensuales llevan IVA (21%) incluido en el total.
-- El pago va directamente al IBAN de LocalShop empresa.
-- ============================================================

-- Añadir columnas de desglose IVA (calculadas desde monthly_fee_eur)
alter table collaborator_subscriptions
  add column if not exists monthly_fee_base numeric(10,2),  -- base imponible (sin IVA)
  add column if not exists monthly_fee_iva  numeric(10,2);  -- IVA 21%

-- Rellenar datos existentes retroactivamente
update collaborator_subscriptions
set
  monthly_fee_base = round(monthly_fee_eur / 1.21, 2),
  monthly_fee_iva  = round(monthly_fee_eur - round(monthly_fee_eur / 1.21, 2), 2);

-- Actualizar register_collaborator_subscription para guardar el desglose
create or replace function register_collaborator_subscription(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_fee      numeric(10,2) := 7.00;  -- tarifa estándar (IVA incluido)
  v_fee_base numeric(10,2);
  v_fee_iva  numeric(10,2);
begin
  v_fee_base := round(v_fee / 1.21, 2);
  v_fee_iva  := round(v_fee - v_fee_base, 2);

  insert into collaborator_subscriptions (
    user_id, trial_ends_at,
    monthly_fee_eur, monthly_fee_base, monthly_fee_iva
  )
  values (
    p_user_id,
    now() + interval '6 months',
    v_fee, v_fee_base, v_fee_iva
  )
  on conflict (user_id) do nothing;
end;
$$;
