-- ════════════════════════════════════════════════════════════════
-- 001_init.sql — Počáteční databázové schéma pro matika-prijimacky
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────
-- Rozšíření auth.users o třídu žáka (6–9)
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trida      SMALLINT NOT NULL CHECK (trida BETWEEN 6 AND 9),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Žák čte vlastní profil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Žák zakládá vlastní profil"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Žák upravuje vlastní profil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── progress ─────────────────────────────────────────────────────
-- Výsledky žáka po jednotlivých úlohách
-- UNIQUE(user_id, tema_id, uloha_id) → upsert neduplicuje záznamy
CREATE TABLE progress (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema_id    TEXT NOT NULL,
  uloha_id   TEXT NOT NULL,
  uspech     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tema_id, uloha_id)
);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Žák čte vlastní progress"
  ON progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Žák vkládá vlastní progress"
  ON progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Žák aktualizuje vlastní progress"
  ON progress FOR UPDATE
  USING (auth.uid() = user_id);

-- ── daily_seeds ──────────────────────────────────────────────────
-- Serverové seedy pro denní sady (volitelné — frontend generuje seed z data)
-- Umožňuje centrální override denního seedy (např. pro testování)
CREATE TABLE daily_seeds (
  datum      DATE PRIMARY KEY,
  seed       INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE daily_seeds ENABLE ROW LEVEL SECURITY;

-- Veřejné čtení — každý přihlášený žák může zjistit dnešní seed
CREATE POLICY "Kdokoliv přihlášený čte seedy"
  ON daily_seeds FOR SELECT
  USING (auth.role() = 'authenticated');

-- Zápis pouze přes service_role (admin/cron) — klienti nemohou přepisovat seedy
-- (žádná INSERT/UPDATE policy pro authenticated)

-- ── Indexy ───────────────────────────────────────────────────────
CREATE INDEX idx_progress_user_id  ON progress (user_id);
CREATE INDEX idx_progress_updated  ON progress (updated_at DESC);
CREATE INDEX idx_progress_tema     ON progress (user_id, tema_id);
