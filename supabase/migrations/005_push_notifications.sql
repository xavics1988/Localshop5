-- ============================================================
-- MIGRACIÓN 005: Web Push Notifications
-- Tabla push_subscriptions para almacenar suscripciones PushManager
-- El trigger de envío se gestiona via Supabase Database Webhook
-- (ver instrucciones en el README del proyecto)
-- ============================================================

-- ── Tabla push_subscriptions ─────────────────────────────────────────────────
-- Almacena la suscripción Web Push de cada colaborador por dispositivo.
-- unique (user_id, endpoint) evita duplicados por dispositivo.

create table if not exists push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- RLS: el colaborador solo gestiona sus propias suscripciones.
-- La Edge Function usa service_role key (bypass RLS) para leer todas.
alter table push_subscriptions enable row level security;

create policy "push_subscriptions: owner select"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions: owner insert"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions: owner delete"
  on push_subscriptions for delete
  using (auth.uid() = user_id);

-- ── CONFIGURAR DATABASE WEBHOOK (manual, en Supabase Dashboard) ──────────────
-- 1. Dashboard > Database > Webhooks > "Create a new hook"
-- 2. Name: notify_new_order
-- 3. Table: orders  |  Event: INSERT
-- 4. Type: HTTP Request  |  Method: POST
-- 5. URL: https://xhhnlneckwoigtuxmcje.supabase.co/functions/v1/send-push-notification
-- 6. HTTP Headers:
--    Authorization: Bearer <service_role_key>
--    Content-Type: application/json
-- El webhook envía automáticamente: { type: 'INSERT', table: 'orders', record: {...} }
