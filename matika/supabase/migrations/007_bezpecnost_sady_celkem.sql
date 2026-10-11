-- ════════════════════════════════════════════════════════════════
-- 007_bezpecnost_sady_celkem.sql — Oprava oprávnění increment_sady_celkem
-- Spusť přes: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- Funkce z 006 běží jako SECURITY DEFINER (obchází RLS) a ID uživatele brala
-- z parametru — kdokoli s veřejným anon klíčem tak mohl zvyšovat počítadlo
-- libovolnému účtu. Teď zvyšuje jen přihlášenému uživateli (auth.uid()).
-- Parametr uid zůstává kvůli kompatibilitě s aplikací, ale ignoruje se.
CREATE OR REPLACE FUNCTION increment_sady_celkem(uid UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles SET sady_celkem = sady_celkem + 1 WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION increment_sady_celkem(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION increment_sady_celkem(UUID) TO authenticated;
