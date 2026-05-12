-- Columna para saber si el colaborador ya vinculó una tarjeta a su suscripción
ALTER TABLE collaborator_subscriptions
  ADD COLUMN IF NOT EXISTS payment_method_attached BOOLEAN DEFAULT FALSE;
