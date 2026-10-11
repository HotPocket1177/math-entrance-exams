-- ════════════════════════════════════════════════════════════════
-- 010_synchronizace.sql — Data žáka sdílená mezi zařízeními
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
--
-- Rozpracované sady (i s konverzacemi), souhrnné statistiky a volba
-- „Slovní úlohy / Jen příklady“ byly jen v prohlížeči. Teď je drží účet.
-- ════════════════════════════════════════════════════════════════

-- ── Rozpracované sady ────────────────────────────────────────────
-- data = { sada: { temaId, nazev, ulohy, index, skore, … }, konverzace: { ulohaId: … } }
CREATE TABLE IF NOT EXISTS rozpracovane_sady (
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sada_id   TEXT        NOT NULL CHECK (char_length(sada_id) <= 64),
  data      JSONB       NOT NULL CHECK (pg_column_size(data) < 600000),
  upraveno  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sada_id)
);

ALTER TABLE rozpracovane_sady ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rozpracovane_sady: vlastní" ON rozpracovane_sady;
CREATE POLICY "rozpracovane_sady: vlastní" ON rozpracovane_sady
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Víc než 30 sad na žáka nedává smysl (aplikace jich drží 20) — ochrana proti zahlcení
CREATE OR REPLACE FUNCTION rozpracovane_sady_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM rozpracovane_sady WHERE user_id = NEW.user_id) >= 30 THEN
    DELETE FROM rozpracovane_sady
     WHERE user_id = NEW.user_id
       AND sada_id IN (SELECT sada_id FROM rozpracovane_sady
                        WHERE user_id = NEW.user_id
                        ORDER BY upraveno ASC LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rozpracovane_sady_limit ON rozpracovane_sady;
CREATE TRIGGER rozpracovane_sady_limit
  BEFORE INSERT ON rozpracovane_sady
  FOR EACH ROW EXECUTE FUNCTION rozpracovane_sady_limit();

-- Starší verze sady nepřepíše novější (opožděné odeslání z jiného zařízení)
CREATE OR REPLACE FUNCTION rozpracovane_sady_jen_novejsi()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.upraveno < OLD.upraveno THEN
    RETURN NULL;   -- změnu tiše přeskoč, na serveru zůstane novější verze
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rozpracovane_sady_jen_novejsi ON rozpracovane_sady;
CREATE TRIGGER rozpracovane_sady_jen_novejsi
  BEFORE UPDATE ON rozpracovane_sady
  FOR EACH ROW EXECUTE FUNCTION rozpracovane_sady_jen_novejsi();

-- ── Statistiky a volba typu úloh v profilu ──────────────────────
-- vysledky = { temaId: { spravne, celkem } }, typ_uloh = { temaId: 'slovni' | 'priklady' }
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vysledky JSONB NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS typ_uloh JSONB NOT NULL DEFAULT '{}';

-- Připočte jeden výsledek — atomicky, dvě zařízení najednou se nepřepíšou
CREATE OR REPLACE FUNCTION zapis_vysledek(p_tema TEXT, p_uspech BOOLEAN)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles
     SET vysledky = jsonb_set(vysledky, ARRAY[p_tema], jsonb_build_object(
           'spravne', COALESCE((vysledky -> p_tema ->> 'spravne')::int, 0) + CASE WHEN p_uspech THEN 1 ELSE 0 END,
           'celkem',  COALESCE((vysledky -> p_tema ->> 'celkem')::int, 0) + 1))
   WHERE id = auth.uid()
     AND char_length(p_tema) BETWEEN 1 AND 40;
$$;

-- Sloučí statistiky z prohlížeče s účtem (u každého tématu vyšší čísla)
-- a vrátí výsledek. Volá se po přihlášení — první přihlášení tak nahraje
-- statistiky nasbírané dřív jen v prohlížeči.
CREATE OR REPLACE FUNCTION sluc_vysledky(p_vysledky JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server JSONB;
  v_nove   JSONB;
BEGIN
  SELECT vysledky INTO v_server FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN '{}'; END IF;
  IF jsonb_typeof(p_vysledky) IS DISTINCT FROM 'object' THEN p_vysledky := '{}'; END IF;

  SELECT COALESCE(jsonb_object_agg(k, jsonb_build_object(
           'spravne', GREATEST(COALESCE((v_server -> k ->> 'spravne')::int, 0),
                               COALESCE((p_vysledky -> k ->> 'spravne')::int, 0)),
           'celkem',  GREATEST(COALESCE((v_server -> k ->> 'celkem')::int, 0),
                               COALESCE((p_vysledky -> k ->> 'celkem')::int, 0)))), '{}')
    INTO v_nove
    FROM (SELECT jsonb_object_keys(v_server) AS k
          UNION
          SELECT jsonb_object_keys(p_vysledky)) klice
   WHERE char_length(k) BETWEEN 1 AND 40;

  UPDATE profiles SET vysledky = v_nove WHERE id = auth.uid();
  RETURN v_nove;
END;
$$;

REVOKE EXECUTE ON FUNCTION zapis_vysledek(TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION sluc_vysledky(JSONB)          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION zapis_vysledek(TEXT, BOOLEAN) TO authenticated;
GRANT  EXECUTE ON FUNCTION sluc_vysledky(JSONB)          TO authenticated;
