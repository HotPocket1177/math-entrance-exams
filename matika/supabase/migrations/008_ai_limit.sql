-- ════════════════════════════════════════════════════════════════
-- 008_ai_limit.sql — Denní limit AI požadavků na uživatele
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- Jeden řádek = jeden uživatel za jeden den (český čas).
-- Zapisuje jen edge funkce „chat“ (service role); uživatel smí číst svoje řádky.
CREATE TABLE IF NOT EXISTS ai_pouziti (
  user_id         UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  den             DATE   NOT NULL,
  pozadavky       INT    NOT NULL DEFAULT 0,
  vstupni_tokeny  BIGINT NOT NULL DEFAULT 0,
  vystupni_tokeny BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, den)
);

ALTER TABLE ai_pouziti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_pouziti: čtení vlastních" ON ai_pouziti;
CREATE POLICY "ai_pouziti: čtení vlastních" ON ai_pouziti
  FOR SELECT USING (auth.uid() = user_id);

-- Zarezervuje jeden požadavek. Vrací nový počet dnešních požadavků,
-- nebo NULL, když je limit vyčerpaný (pak se nic nezapočítá).
-- Atomické — souběžné požadavky limit nepřekročí.
CREATE OR REPLACE FUNCTION ai_zarezervuj(p_user UUID, p_limit INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pocet INT;
BEGIN
  INSERT INTO ai_pouziti (user_id, den, pozadavky)
  VALUES (p_user, (now() AT TIME ZONE 'Europe/Prague')::date, 1)
  ON CONFLICT (user_id, den) DO UPDATE
    SET pozadavky = ai_pouziti.pozadavky + 1
    WHERE ai_pouziti.pozadavky < p_limit
  RETURNING pozadavky INTO v_pocet;
  RETURN v_pocet;
END;
$$;

-- Po odpovědi modelu připíše spotřebované tokeny (pro přehled nákladů).
CREATE OR REPLACE FUNCTION ai_zapis_tokeny(p_user UUID, p_vstup INT, p_vystup INT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_pouziti
     SET vstupni_tokeny  = vstupni_tokeny  + GREATEST(p_vstup, 0),
         vystupni_tokeny = vystupni_tokeny + GREATEST(p_vystup, 0)
   WHERE user_id = p_user
     AND den = (now() AT TIME ZONE 'Europe/Prague')::date;
$$;

-- Volat je smí jen server (service role), ne prohlížeč
REVOKE EXECUTE ON FUNCTION ai_zarezervuj(UUID, INT)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION ai_zapis_tokeny(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION ai_zarezervuj(UUID, INT)        TO service_role;
GRANT  EXECUTE ON FUNCTION ai_zapis_tokeny(UUID, INT, INT) TO service_role;
