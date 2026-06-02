-- Saved delivery addresses per user
CREATE TABLE IF NOT EXISTS saved_addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Casa',
  name        text NOT NULL,
  street      text NOT NULL,
  number      text NOT NULL DEFAULT '',
  postal_code text NOT NULL,
  city        text NOT NULL,
  province    text NOT NULL,
  phone       text NOT NULL DEFAULT '',
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own addresses"
  ON saved_addresses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
