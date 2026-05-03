-- ════════════════════════════════════════════════════════════════
-- 006_sady_celkem.sql — Kumulativní počet dokončených sad (cross-device)
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sady_celkem INTEGER NOT NULL DEFAULT 0;

-- Atomic increment (bez race condition při souběžném hraní na více zařízeních)
CREATE OR REPLACE FUNCTION increment_sady_celkem(uid UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE profiles SET sady_celkem = sady_celkem + 1 WHERE id = uid;
$$;
