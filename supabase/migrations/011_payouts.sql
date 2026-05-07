-- ============================================================
-- MIGRACIÓN 011: Sistema de pagos semanales a vendedores
-- Cada lunes a las 06:00 UTC se generan registros de pago
-- automáticamente (pg_cron). La transferencia real se
-- implementará con Stripe Connect en el futuro.
-- ============================================================

-- Tabla de pagos semanales a vendedores
create table if not exists payouts (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references profiles(id),
  store_id     text references stores(id),
  period_start timestamptz not null,
  period_end   timestamptz not null,
  gross_amount numeric(10,2) not null default 0,   -- subtotal neto a transferir al vendedor
  status       text not null default 'pending'
               check (status in ('pending', 'processing', 'completed', 'failed')),
  iban         text,          -- IBAN destino (snapshot en el momento de generación)
  reference    text,          -- referencia bancaria de la transferencia (Stripe / manual)
  processed_at timestamptz,
  created_at   timestamptz default now()
);

create index if not exists payouts_seller_id_idx  on payouts(seller_id);
create index if not exists payouts_status_idx     on payouts(status);
create index if not exists payouts_created_at_idx on payouts(created_at desc);

-- RLS: vendedores solo ven sus propios pagos
alter table payouts enable row level security;

create policy "sellers_view_own_payouts"
  on payouts for select
  using (seller_id = auth.uid());

-- Solo service_role (backend / Stripe webhook) puede crear y actualizar pagos
create policy "service_insert_payouts"
  on payouts for insert
  with check (auth.role() = 'service_role');

create policy "service_update_payouts"
  on payouts for update
  using (auth.role() = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- Función: genera registros de pago para todos los vendedores
-- con facturas de colaborador emitidas en la semana anterior.
-- Se ejecuta cada lunes vía pg_cron.
-- ──────────────────────────────────────────────────────────────
create or replace function generate_weekly_payouts()
returns void language plpgsql security definer as $$
declare
  v_period_end   timestamptz := date_trunc('week', now()); -- lunes 00:00 UTC
  v_period_start timestamptz := v_period_end - interval '7 days';
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
    -- Suma de subtotales de ese vendedor en el periodo
    select coalesce(sum(subtotal), 0)
      into v_amount
      from invoices
     where recipient_id   = rec.seller_id
       and recipient_type = 'collaborator'
       and issued_at      >= v_period_start
       and issued_at      <  v_period_end;

    if v_amount > 0 then
      -- IBAN preferido: primero cuenta bancaria marcada como default, luego la de la tienda
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

-- ──────────────────────────────────────────────────────────────
-- Cron job: cada lunes a las 06:00 UTC
-- Requiere que pg_cron esté habilitado en el proyecto Supabase
-- (Database > Extensions > pg_cron).
-- ──────────────────────────────────────────────────────────────
select cron.schedule(
  'weekly-seller-payouts',
  '0 6 * * 1',
  $$ select generate_weekly_payouts(); $$
);
