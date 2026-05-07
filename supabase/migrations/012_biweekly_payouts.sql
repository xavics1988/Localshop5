-- ============================================================
-- MIGRACIÓN 012: Cambiar pagos de semanales a quincenales
-- Los pagos se generan los días 1 y 15 de cada mes.
-- Esto da un margen de ~15 días para gestionar devoluciones
-- antes de transferir el dinero al vendedor.
-- ============================================================

-- Eliminar el cron job semanal anterior
select cron.unschedule('weekly-seller-payouts');

-- Actualizar la función para usar periodos de 15 días
create or replace function generate_weekly_payouts()
returns void language plpgsql security definer as $$
declare
  v_period_end   timestamptz := date_trunc('day', now());         -- hoy a las 00:00 UTC
  v_period_start timestamptz := v_period_end - interval '15 days';
  rec            record;
  v_amount       numeric(10,2);
  v_iban         text;
  v_store_id     text;
begin
  for rec in
    select distinct i.recipient_id as seller_id
      from invoices i
     where i.recipient_type = 'collaborator'
       and i.issued_at      >= v_period_start
       and i.issued_at      <  v_period_end
  loop
    select coalesce(sum(subtotal), 0)
      into v_amount
      from invoices
     where recipient_id   = rec.seller_id
       and recipient_type = 'collaborator'
       and issued_at      >= v_period_start
       and issued_at      <  v_period_end;

    if v_amount > 0 then
      select
        coalesce(
          (select iban from bank_accounts where user_id = rec.seller_id and is_default = true limit 1),
          (select iban from stores where owner_id = rec.seller_id limit 1)
        ),
        (select id from stores where owner_id = rec.seller_id limit 1)
      into v_iban, v_store_id;

      insert into payouts (
        seller_id, store_id, period_start, period_end,
        gross_amount, status, iban
      )
      values (
        rec.seller_id, v_store_id, v_period_start, v_period_end,
        v_amount, 'pending', v_iban
      );
    end if;
  end loop;
end;
$$;

-- Nuevo cron: días 1 y 15 de cada mes a las 06:00 UTC
select cron.schedule(
  'biweekly-seller-payouts',
  '0 6 1,15 * *',
  $$ select generate_weekly_payouts(); $$
);
