-- ============================================================
-- 027 — Bucket return-evidence con políticas de storage
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('return-evidence', 'return-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "return-evidence: authenticated can upload" ON storage.objects;
DROP POLICY IF EXISTS "return-evidence: authenticated can read"   ON storage.objects;
DROP POLICY IF EXISTS "return-evidence: authenticated can delete" ON storage.objects;

-- El cliente sube la foto (INSERT)
CREATE POLICY "return-evidence: authenticated can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'return-evidence');

-- Ambas partes leen las fotos (SELECT)
CREATE POLICY "return-evidence: authenticated can read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'return-evidence');

-- El que subió puede borrar (DELETE)
CREATE POLICY "return-evidence: authenticated can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'return-evidence');
