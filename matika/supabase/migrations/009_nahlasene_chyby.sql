-- ════════════════════════════════════════════════════════════════
-- 009_nahlasene_chyby.sql — Hlášení chyb v úlohách od žáků
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
--
-- Prohlížení: Table Editor → nahlasene_chyby, nebo v SQL Editoru:
--   SELECT vytvoreno, duvod, popis, uloha->>'zadani' AS zadani,
--          uloha->>'odpoved' AS odpoved, stav
--     FROM nahlasene_chyby ORDER BY vytvoreno DESC;
-- Vyřízené označ: UPDATE nahlasene_chyby SET stav = 'vyresena' WHERE id = …;
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nahlasene_chyby (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vytvoreno   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Smazáním účtu zmizí i jeho hlášení (zásady slibují smazání všech dat)
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  duvod       TEXT NOT NULL CHECK (duvod IN ('vysledek', 'zadani', 'kouc', 'jine')),
  popis       TEXT CHECK (char_length(popis) <= 1000),
  tema_id     TEXT,
  uloha_id    TEXT,
  uloha       JSONB,          -- snímek úlohy: zadání, odpověď, postup, kontrola
  konverzace  JSONB,          -- posledních pár zpráv mezi žákem a koučem
  verze       TEXT,
  stav        TEXT NOT NULL DEFAULT 'nova' CHECK (stav IN ('nova', 'vyresena', 'zamitnuta')),
  CHECK (pg_column_size(uloha) < 20000 AND pg_column_size(konverzace) < 40000)
);

ALTER TABLE nahlasene_chyby ENABLE ROW LEVEL SECURITY;

-- Přihlášený žák smí vložit hlášení pod svým jménem a číst jen svoje (export dat);
-- měnit ani mazat je z prohlížeče nesmí
DROP POLICY IF EXISTS "nahlasene_chyby: vložení vlastních" ON nahlasene_chyby;
CREATE POLICY "nahlasene_chyby: vložení vlastních" ON nahlasene_chyby
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "nahlasene_chyby: čtení vlastních" ON nahlasene_chyby;
CREATE POLICY "nahlasene_chyby: čtení vlastních" ON nahlasene_chyby
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Ochrana proti zahlcení: max 30 hlášení na uživatele za den
CREATE OR REPLACE FUNCTION nahlasene_chyby_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM nahlasene_chyby
       WHERE user_id = NEW.user_id AND vytvoreno > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'Dnes už jsi poslal/a hodně hlášení, zkus to prosím zítra.';
  END IF;
  -- Stav nastavuje jen autor, ne žák
  NEW.stav := 'nova';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nahlasene_chyby_limit ON nahlasene_chyby;
CREATE TRIGGER nahlasene_chyby_limit
  BEFORE INSERT ON nahlasene_chyby
  FOR EACH ROW EXECUTE FUNCTION nahlasene_chyby_limit();
