-- 003_notifications.sql — sloupce pro systém upozornění na novinky

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_version TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_updates     BOOLEAN DEFAULT NULL;

-- last_seen_version: verze aplikace, kterou uživatel naposledy viděl v "Co je nového" modalu
-- email_updates:     NULL = nezeptáno, TRUE = opt-in, FALSE = opt-out
