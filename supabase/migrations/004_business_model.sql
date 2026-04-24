-- ============================================================
-- MIGRACIÓN 004: Modelo de negocio LocalShop
-- Aplicar en Supabase Dashboard (SQL Editor) cuando se active
-- la facturación real de suscripciones y comisiones de envío.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Trazabilidad de comisión de envío en pedidos
--    Permite saber exactamente cuánto corresponde a LocalShop
--    por cada pedido procesado.
-- ------------------------------------------------------------
alter table orders
  add column if not exists shipping_fee numeric(10,2) not null default 3.99;

-- ------------------------------------------------------------
-- 2. Tabla de suscripciones de colaboradores
--    Registra el estado y fechas de cada colaborador.
--    Se crea al registrarse como colaborador.
-- ------------------------------------------------------------
create table if not exists collaborator_subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  status              text not null default 'trial'
                        check (status in ('trial', 'active', 'cancelled')),
  trial_starts_at     timestamptz not null default now(),
  trial_ends_at       timestamptz not null,  -- trial_starts_at + 6 meses
  monthly_fee_eur     numeric(10,2) not null default 7.00,
  next_billing_date   timestamptz,           -- se establece al terminar el trial
  last_payment_at     timestamptz,
  created_at          timestamptz not null default now(),
  unique (user_id)
);

-- RLS: el colaborador solo ve su propia suscripción
alter table collaborator_subscriptions enable row level security;

create policy "sub: owner lee"
  on collaborator_subscriptions for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. RPC: registrar suscripción al crear cuenta colaborador
--    Llamar desde el cliente cuando un usuario se registra
--    con role = 'colaborador'.
-- ------------------------------------------------------------
create or replace function register_collaborator_subscription(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into collaborator_subscriptions (user_id, trial_ends_at)
  values (p_user_id, now() + interval '6 months')
  on conflict (user_id) do nothing;
end;
$$;

-- ------------------------------------------------------------
-- 4. RPC: activar suscripción (llamar cuando trial expira y
--    el colaborador realiza el primer pago mensual).
-- ------------------------------------------------------------
create or replace function activate_collaborator_subscription(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update collaborator_subscriptions
  set
    status            = 'active',
    next_billing_date = now() + interval '1 month',
    last_payment_at   = now()
  where user_id = p_user_id;
end;
$$;

-- ------------------------------------------------------------
-- 5. Actualizar place_order para guardar la comisión de envío
--    Reemplaza la función existente añadiendo p_shipping_fee.
-- ------------------------------------------------------------
create or replace function place_order(
  p_order_id          text,
  p_customer_id       uuid,
  p_customer_name     text,
  p_items             jsonb,
  p_total             numeric,
  p_destination_iban  text,
  p_referred_by       text    default null,
  p_is_first_purchase boolean default false,
  p_shipping_fee      numeric default 3.99
)
returns void language plpgsql security definer as $$
declare
  item        jsonb;
  product_id  text;
  qty         integer;
  variant_key text;
begin
  -- Insertar pedido con comisión de envío
  insert into orders (id, customer_id, customer_name, items, total, shipping_fee, destination_iban, status, history)
  values (
    p_order_id,
    p_customer_id,
    p_customer_name,
    p_items,
    p_total,
    p_shipping_fee,
    p_destination_iban,
    'Nuevo',
    jsonb_build_array(jsonb_build_object(
      'date',   now()::text,
      'status', 'Nuevo',
      'label',  'Pedido Realizado'
    ))
  );

  -- Decrementar stock por cada item
  for item in select * from jsonb_array_elements(p_items) loop
    product_id  := item->'product'->>'id';
    qty         := (item->>'quantity')::integer;
    variant_key := item->>'variant';

    update products
    set
      stock = greatest(0, stock - qty),
      stock_per_size = case
        when variant_key is not null and variant_key != 'null' and stock_per_size ? variant_key
        then jsonb_set(
          stock_per_size,
          array[variant_key],
          to_jsonb(greatest(0, (stock_per_size->>variant_key)::integer - qty))
        )
        else stock_per_size
      end
    where id = product_id;
  end loop;

  -- Recompensa de referido: solo en primera compra
  if p_is_first_purchase and p_referred_by is not null and p_referred_by != '' then
    perform increment_referral_balance(p_referred_by, 2);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- INSTRUCCIONES DE ACTIVACIÓN (ejecutar en orden)
-- 1. Pegar y ejecutar este script completo en:
--    Supabase Dashboard > SQL Editor > New query
-- 2. Cuando tengas el IBAN real de empresa, actualizar .env.local:
--      VITE_COMPANY_HOLDER = "Nombre real del titular"
--      VITE_COMPANY_IBAN   = "ESxx xxxx xxxx xxxx xxxx xxxx"
--      VITE_COMPANY_BANK   = "Nombre del banco"
-- ------------------------------------------------------------
