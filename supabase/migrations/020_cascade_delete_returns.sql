-- ============================================================
-- MIGRACIÓN 020: Borrado en cascada en return_requests y return_messages
-- Al borrar un usuario → se borran sus solicitudes de devolución y mensajes
-- ============================================================

-- 1. return_requests.customer_id → CASCADE
ALTER TABLE return_requests
  DROP CONSTRAINT IF EXISTS return_requests_customer_id_fkey;

ALTER TABLE return_requests
  ADD CONSTRAINT return_requests_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. return_requests.collaborator_id → CASCADE
ALTER TABLE return_requests
  DROP CONSTRAINT IF EXISTS return_requests_collaborator_id_fkey;

ALTER TABLE return_requests
  ADD CONSTRAINT return_requests_collaborator_id_fkey
  FOREIGN KEY (collaborator_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. return_messages.sender_id → CASCADE
ALTER TABLE return_messages
  DROP CONSTRAINT IF EXISTS return_messages_sender_id_fkey;

ALTER TABLE return_messages
  ADD CONSTRAINT return_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
