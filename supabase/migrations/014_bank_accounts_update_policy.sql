-- ============================================================
-- MIGRACIÓN 014: Política de actualización para bank_accounts
-- Permite a los colaboradores marcar su cuenta bancaria por defecto
-- desde la pantalla de Configuración de Cobros.
-- ============================================================

drop policy if exists "users_update_own_bank_accounts" on bank_accounts;

create policy "users_update_own_bank_accounts"
  on bank_accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
