-- ════════════════════════════════════════════════════════════════
-- 004_session_datum.sql — Přidá sloupec datum do session_progress
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- Sloupec datum sleduje KDY byl count naposledy upravený.
-- Bez něj se count 1/3 nebo 2/3 nikdy neresetoval (uzamceno_do bylo NULL).
ALTER TABLE session_progress
  ADD COLUMN IF NOT EXISTS datum DATE DEFAULT NULL;
