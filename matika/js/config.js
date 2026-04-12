// config.js — konfigurace aplikace

const CONFIG = {
  // ── Supabase ──────────────────────────────────────────────────
  // Po vytvoření projektu na supabase.com dosaď své hodnoty:
  // Settings → API → Project URL + anon public key
  supabaseUrl:     'https://rbdjjeyhycxmhadjixop.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZGpqZXloeWN4bWhhZGppeG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDkxMDEsImV4cCI6MjA5MTU4NTEwMX0.akj4EICFYrwm1dO0YZtJyD6O8X6rb2E3xQcfFNF1qD0',

  // URL Supabase Edge Function (automaticky dostupná po nasazení)
  edgeFunctionUrl: 'https://rbdjjeyhycxmhadjixop.supabase.co/functions/v1/chat',

  // ── OpenAI ────────────────────────────────────────────────────
  model: 'gpt-4o-mini',

  // Starý localStorage klíč — zachován pro legacy fallback (bez auth)
  apiKeyStorageKey: 'matika_openai_key',

  // ── Feature flags ─────────────────────────────────────────────
  // true  = volání přes Supabase Edge Function (JWT auth, klíč v secrets)
  // false = přímé volání OpenAI z prohlížeče (dev mód bez Supabase)
  useEdgeFunction: true
};
