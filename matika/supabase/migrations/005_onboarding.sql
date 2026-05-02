-- ════════════════════════════════════════════════════════════════
-- 005_onboarding.sql — Přidá onboarding_done do profiles
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- DEFAULT TRUE → stávající uživatelé onboarding nevidí.
-- Nové účty dostanou FALSE (explicitní INSERT v app.js při tvorbě profilu).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN NOT NULL DEFAULT TRUE;
