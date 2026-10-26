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
  appVersion:   'v1.10',
  appChangelog: 'Aktualizace podle CERMAT (26. 10. 2026): z požadavků k přijímačkám na čtyřleté obory vypadl objem a povrch válce, úlohy s koulí, konstrukce tečny, kružnice opsané a Thaletovy kružnice, rozklad podle vzorců (a ± b)² a a² − b² a pravidla pro odmocňování zlomku a součinu. NSN a NSD se zkoušejí jen pro dvě čísla a u soustav rovnic si metodu řešení vybereš sám. Úlohy v Matice jsme podle toho upravili.'
};
