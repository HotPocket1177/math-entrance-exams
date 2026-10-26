// config.js — konfigurace aplikace

const CONFIG = {
  // ── Supabase ──────────────────────────────────────────────────
  // Po vytvoření projektu na supabase.com dosaď své hodnoty:
  // Settings → API → Project URL + anon public key
  supabaseUrl:     'https://rbdjjeyhycxmhadjixop.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZGpqZXloeWN4bWhhZGppeG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDkxMDEsImV4cCI6MjA5MTU4NTEwMX0.akj4EICFYrwm1dO0YZtJyD6O8X6rb2E3xQcfFNF1qD0',

  // URL Supabase Edge Function (proxy na Claude — model a API klíč jsou v jejích secrets)
  edgeFunctionUrl: 'https://rbdjjeyhycxmhadjixop.supabase.co/functions/v1/quick-function',

  // ── Verze aplikace (novinky) ──────────────────────────────────
  // Při vydání nové verze změň appVersion — uživatelům se zobrazí modal "Co je nového".
  appVersion:   'v1.11',
  appChangelog: 'Nové pomůcky při řešení: vedle každé úlohy najdeš „📝 Moje výpočty“, kam si můžeš počítat (s tlačítky pro ², √, π a další symboly), a „📌 Tahák“ se vzorci k tématu, který si upravíš po svém. Obojí se ukládá k tvému účtu a v profilu to jde vypnout.'
};
