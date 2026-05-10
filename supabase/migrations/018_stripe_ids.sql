-- Añade los campos necesarios para la integración con Stripe
-- en las tablas existentes (pedidos, perfiles, tiendas, suscripciones, payouts)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded  BOOLEAN DEFAULT FALSE;

ALTER TABLE collaborator_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT;

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

ALTER TABLE payment_cards
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
