-- ════════════════════════════════════════════════════════════════
-- 002_session_progress.sql — Denní session progress (limit 3× za den)
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- ── Odstraň daily_seeds (již se nepoužívá) ────────────────────────
DROP TABLE IF EXISTS daily_seeds;

-- ── session_progress ─────────────────────────────────────────────
-- Sleduje kolikrát žák dokončil sadu v daném tématu dnes.
-- uzamceno_do = NULL → volno; DATE = uzamčeno do tohoto dne (včetně).
-- Reset nastane při načtení aplikace: pokud uzamceno_do < dnes → count=0, uzamceno_do=NULL.
CREATE TABLE session_progress (
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tema_id         TEXT NOT NULL,
  dokonceni_count SMALLINT NOT NULL DEFAULT 0,
  uzamceno_do     DATE,
  PRIMARY KEY (user_id, tema_id)
);

ALTER TABLE session_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Žák čte vlastní session progress"
  ON session_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Žák vkládá vlastní session progress"
  ON session_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Žák aktualizuje vlastní session progress"
  ON session_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_session_progress_user ON session_progress (user_id);
