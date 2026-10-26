-- ════════════════════════════════════════════════════════════════
-- 011_pomucky.sql — Nastavení pomůcek a taháky k tématům
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
--
-- nastaveni = { poznamky: true|false, tahak: true|false }
-- tahaky    = { temaId: "text taháku" }
-- Poznámky k jednotlivým úlohám se ukládají s rozpracovanou sadou
-- (tabulka rozpracovane_sady), nepotřebují vlastní sloupec.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nastaveni JSONB NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tahaky    JSONB NOT NULL DEFAULT '{}';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tahaky_velikost;
ALTER TABLE profiles ADD CONSTRAINT profiles_tahaky_velikost
  CHECK (pg_column_size(tahaky) < 100000 AND pg_column_size(nastaveni) < 2000);
