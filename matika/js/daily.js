// daily.js — generátor denní sady úloh (deterministický seed + náhodný výběr)

const Daily = (() => {

  // ── LCG (Linear Congruential Generator) ──────────────────────
  // Deterministický PRNG — stejný seed → stejná sekvence čísel.
  // Konstanty z Numerical Recipes (Knuth).
  function lcg(seed) {
    let s = seed >>> 0; // unsigned 32-bit
    return function rand() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0xFFFFFFFF; // [0, 1)
    };
  }

  // ── Seed pro dnešní den ───────────────────────────────────────
  // Vrátí integer ve formátu YYYYMMDD podle časové zóny Europe/Prague.
  // Reset probíhá přesně o půlnoci českého času pro všechny žáky.
  function getDailySeed() {
    const dnes = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
    // dnes = "2026-04-13"
    return parseInt(dnes.replace(/-/g, ''), 10); // 20260413
  }

  // ── Denní sada 5 úloh ─────────────────────────────────────────
  // Deterministicky vybere 5 různých úloh z odemčených témat.
  // Výsledek je každý den jiný, ale pro všechny žáky téže třídy stejný.
  function generateDailySet(trida, tydenvRoce, seed) {
    const rand = lcg(seed);
    const odemcenaIds = Syllabus.getOdemcenaTemata(trida, tydenvRoce);
    const dostupnaTemata = TEMATA.filter(t => odemcenaIds.includes(t.id));

    if (dostupnaTemata.length === 0) return [];

    // Celkový pool všech úloh z odemčených témat
    const pool = [];
    dostupnaTemata.forEach(tema => {
      tema.ulohy.forEach(uloha => {
        pool.push({ ...uloha, _temaId: tema.id, _temaNazev: tema.nazev });
      });
    });

    if (pool.length === 0) return [];

    // Fisher-Yates shuffle s LCG seeded randem → deterministicky zamíchej pool
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Vezmi prvních 5 (nebo méně pokud pool je malý)
    return shuffled.slice(0, 5);
  }

  // ── Náhodná úloha z tématu ────────────────────────────────────
  // Používá Math.random() — není deterministická (pro tlačítko "Náhodná úloha").
  function generateRandomUloha(temaId) {
    const tema = TEMATA.find(t => t.id === temaId);
    if (!tema || tema.ulohy.length === 0) return null;
    const idx = Math.floor(Math.random() * tema.ulohy.length);
    return { ...tema.ulohy[idx], _temaId: temaId, _temaNazev: tema.nazev };
  }

  return { generateDailySet, generateRandomUloha, getDailySeed };
})();
