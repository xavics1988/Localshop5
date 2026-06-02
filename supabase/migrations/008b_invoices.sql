-- ============================================================
-- Facturas simplificadas automáticas
-- Se generan al pasar un pedido a 'Completado' (manual o auto).
-- Auto-complete: pg_cron completa pedidos con >7 días en estado
-- activo ('Nuevo' o 'En Proceso') si nadie lo ha marcado.
-- ============================================================

-- Habilitar pg_cron (extensión nativa de Supabase)
create extension if not exists pg_cron;

-- ============================================================
-- TABLE: invoices
-- ============================================================
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        text not null references orders(id) on delete cascade,

  -- Destinatario
  recipient_type  text not null check (recipient_type in ('customer', 'collaborator')),
  recipient_id    uuid not null references profiles(id) on delete cascade,

  -- Número de factura correlativo (por año y tipo)
  invoice_number  text not null unique,

  -- Datos fiscales del colaborador (snapshot en el momento de emisión)
  store_id        text,
  store_name      text,
  store_cif       text,
  store_address   text,

  -- Datos del cliente (snapshot)
  customer_name   text,
  customer_email  text,

  -- Importes
  subtotal        numeric(10,2) not null,  -- suma de items sin comisión
  fee_base        numeric(10,2),           -- base imponible comisión LocalShop
  fee_iva         numeric(10,2),           -- IVA 21% sobre comisión
  fee_total       numeric(10,2),           -- comisión total (fee_base + fee_iva)
  total           numeric(10,2) not null,  -- total que pagó el cliente

  -- Desglose de items (snapshot)
  items           jsonb not null default '[]',

  -- Metadatos
  issued_at       timestamptz not null default now(),
  auto_completed  boolean not null default false  -- true si fue auto-completado
);

-- Índices de consulta frecuente
create index if not exists invoices_order_id_idx        on invoices(order_id);
create index if not exists invoices_recipient_id_idx    on invoices(recipient_id);
create index if not exists invoices_recipient_type_idx  on invoices(recipient_type, recipient_id);

-- RLS
alter table invoices enable row level security;

drop policy if exists "invoices_select_own"    on invoices;
drop policy if exists "invoices_insert_service" on invoices;

-- Cada usuario sólo ve sus propias facturas
create policy "invoices_select_own" on invoices
  for select using (recipient_id = auth.uid());

-- Sólo funciones internas (security definer) pueden insertar
create policy "invoices_insert_service" on invoices
  for insert with check (false);

-- ============================================================
-- SEQUENCE: número de factura correlativo por año
-- Formato: FS-YYYY-NNNNNN  (FS = Factura Simplificada)
-- ============================================================
create sequence if not exists invoice_number_seq;

create or replace function next_invoice_number()
returns text language plpgsql as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_seq  bigint;
begin
  v_seq := nextval('invoice_number_seq');
  return 'FS-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

-- ============================================================
-- FUNCTION: create_invoices_for_order(p_order_id, p_auto)
-- Genera dos facturas (cliente + colaborador) para un pedido.
-- Idempotente: no hace nada si ya existen.
-- ============================================================
create or replace function create_invoices_for_order(
  p_order_id    text,
  p_auto        boolean default false
)
returns void language plpgsql security definer as $$
declare
  v_order       orders%rowtype;
  v_store       stores%rowtype;
  v_customer    profiles%rowtype;
  v_collab_id   uuid;
  v_subtotal    numeric(10,2);
begin
  -- Salir si ya existen facturas para este pedido
  if exists (select 1 from invoices where order_id = p_order_id) then
    return;
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then return; end if;

  -- Datos del cliente
  select * into v_customer from profiles where id = v_order.customer_id;

  -- Datos de la tienda / colaborador
  if v_order.store_id is not null then
    select * into v_store from stores where id = v_order.store_id;
    -- Propietario de la tienda = colaborador
    v_collab_id := v_store.owner_id;
  end if;

  -- Subtotal: total del pedido menos la comisión LocalShop
  v_subtotal := v_order.total - coalesce(v_order.shipping_fee, 0);

  -- ── Factura para el CLIENTE ──────────────────────────────
  insert into invoices (
    order_id, recipient_type, recipient_id,
    invoice_number,
    store_id, store_name, store_cif, store_address,
    customer_name, customer_email,
    subtotal, fee_base, fee_iva, fee_total, total,
    items, issued_at, auto_completed
  ) values (
    p_order_id, 'customer', v_order.customer_id,
    next_invoice_number(),
    v_order.store_id, v_store.name, v_store.cif, v_store.address,
    v_customer.name, v_customer.email,
    v_subtotal,
    v_order.fee_base, v_order.fee_iva,
    coalesce(v_order.shipping_fee, 0),
    v_order.total,
    v_order.items, now(), p_auto
  );

  -- ── Factura para el COLABORADOR ──────────────────────────
  -- Solo si la tienda tiene propietario identificado
  if v_collab_id is not null then
    insert into invoices (
      order_id, recipient_type, recipient_id,
      invoice_number,
      store_id, store_name, store_cif, store_address,
      customer_name, customer_email,
      subtotal, fee_base, fee_iva, fee_total, total,
      items, issued_at, auto_completed
    ) values (
      p_order_id, 'collaborator', v_collab_id,
      next_invoice_number(),
      v_order.store_id, v_store.name, v_store.cif, v_store.address,
      v_customer.name, v_customer.email,
      v_subtotal,
      v_order.fee_base, v_order.fee_iva,
      coalesce(v_order.shipping_fee, 0),
      v_order.total,
      v_order.items, now(), p_auto
    );
  end if;
end;
$$;

-- ============================================================
-- TRIGGER: al pasar un pedido a 'Completado', genera facturas
-- ============================================================
create or replace function trigger_invoice_on_complete()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'Completado' and old.status <> 'Completado' then
    perform create_invoices_for_order(new.id, false);
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_on_order_complete on orders;
create trigger invoice_on_order_complete
  after update on orders
  for each row execute function trigger_invoice_on_complete();

-- ============================================================
-- FUNCTION: auto_complete_old_orders()
-- Completa pedidos con >7 días sin actualización y genera facturas.
-- Se ejecuta diariamente vía pg_cron.
-- ============================================================
create or replace function auto_complete_old_orders()
returns void language plpgsql security definer as $$
declare
  v_order orders%rowtype;
  v_event jsonb;
begin
  for v_order in
    select * from orders
    where status in ('Nuevo', 'En Proceso')
      and created_at < now() - interval '7 days'
  loop
    v_event := jsonb_build_object(
      'date',   now()::text,
      'status', 'Completado',
      'label',  'Completado Automáticamente (7 días)'
    );

    update orders
    set
      status  = 'Completado',
      history = coalesce(history, '[]'::jsonb) || v_event
    where id = v_order.id;

    -- El trigger invoice_on_order_complete dispara aquí,
    -- pero llamamos directamente con auto=true por si el trigger
    -- no captura updates dentro de funciones security definer.
    perform create_invoices_for_order(v_order.id, true);
  end loop;
end;
$$;

-- ============================================================
-- pg_cron: ejecutar auto_complete_old_orders cada día a las 02:00
-- ============================================================
select cron.unschedule('auto-complete-old-orders') where exists (
  select 1 from cron.job where jobname = 'auto-complete-old-orders'
);

select cron.schedule(
  'auto-complete-old-orders',
  '0 2 * * *',
  $$select auto_complete_old_orders()$$
);
