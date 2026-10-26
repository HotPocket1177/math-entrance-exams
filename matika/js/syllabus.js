// syllabus.js — ŠVP mapa: třída → odemčená témata + filtrace úloh

// ── Aktualizace požadavků CERMAT (26. 10. 2026, čtyřleté obory) ──
// Učivo vypuštěné z požadavků k přijímací zkoušce. Používá ho generátor
// (do promptu + kontrola vygenerovaného zadání) i kouč.
const CERMAT_POZADAVKY = {
  datum: '26. 10. 2026',
  // Text do promptů AI
  prompt: `AKTUÁLNÍ POŽADAVKY CERMAT (aktualizace 26. 10. 2026, čtyřleté obory) — úloha NESMÍ vyžadovat:
- určení nejmenšího společného násobku nebo největšího společného dělitele TŘÍ a více čísel (jen dvou čísel); žákům 6.–8. třídy nestav úlohu přímo na určení NSN/NSD
- pravidla pro odmocňování zlomku nebo součinu (např. $\\sqrt{\\frac{a}{b}}$, $\\sqrt{a \\cdot b}$)
- rozklad výrazu na součin pomocí vzorců $(a+b)^2$, $(a-b)^2$, $a^2-b^2$
- konstrukci tečny ke kružnici, kružnice opsané trojúhelníku ani Thaletovu kružnici
- objem nebo povrch válce ani úlohy s koulí (poloměr, průměr)
Soustavu dvou rovnic se dvěma neznámými zadávat smíš, ale NEPŘEDEPISUJ metodu řešení (dosazovací ani sčítací) — žák si zvolí sám.`,
  // Zadání, které na vypuštěné učivo nejspíš míří (pojistka po vygenerování)
  vyloucene: /válc|válec|koul[eií]|thalet|tečn\p{L}* ke kružnic|kružnic\p{L}* opsan|opsan\p{L}* kružnic|rozlož\p{L}* na součin|rozklad\p{L}* na součin|dosazovací metod|sčítací metod/iu
};

const Syllabus = (() => {

  // Která témata a podtypy jsou dostupné pro danou třídu
  const TRIDA_TEMATA = {
    6: {
      slovni:    { odemceno: true,  podtypy: ['zakladni'] },
      zlomky:    { odemceno: true,  podtypy: ['zakladni'] },
      procenta:  { odemceno: false },
      rovnice:   { odemceno: false },
      geometrie: { odemceno: true,  podtypy: ['obvod', 'obsah_zakladni'] },
      grafy:     { odemceno: false }
    },
    7: {
      slovni:    { odemceno: true,  podtypy: ['zakladni', 'pomer'] },
      zlomky:    { odemceno: true,  podtypy: ['zakladni', 'operace'] },
      procenta:  { odemceno: true,  podtypy: ['zakladni', 'zpetny'] },
      rovnice:   { odemceno: true,  podtypy: ['linearni'] },
      geometrie: { odemceno: true,  podtypy: ['obvod', 'obsah_zakladni'] },
      grafy:     { odemceno: false }
    },
    8: {
      slovni:    { odemceno: true,  podtypy: ['zakladni', 'soustava'] },
      zlomky:    { odemceno: true,  podtypy: ['vse'] },
      procenta:  { odemceno: true,  podtypy: ['vse'] },
      rovnice:   { odemceno: true,  podtypy: ['linearni', 'soustava', 'absolutni'] },
      geometrie: { odemceno: true,  podtypy: ['vse'] },
      grafy:     { odemceno: true,  podtypy: ['cteni_dat', 'prumery'] }
    },
    9: {
      slovni:    { odemceno: true,  podtypy: ['vse'] },
      zlomky:    { odemceno: true,  podtypy: ['vse'] },
      procenta:  { odemceno: true,  podtypy: ['vse'] },
      rovnice:   { odemceno: true,  podtypy: ['vse'] },
      geometrie: { odemceno: true,  podtypy: ['vse'] },
      grafy:     { odemceno: true,  podtypy: ['vse'] }
    }
  };

  // SVP_MAP[trida][temaId] = minimální týden školního roku pro odemčení
  // Školní rok začíná 1. září (týden 1) a má ~40 výukových týdnů.
  // Témata odpovídají id z TEMATA v ulohy.js:
  //   slovni | procenta | zlomky | rovnice | geometrie | grafy
  const SVP_MAP = {
    6: {
      slovni:    1,   // Slovní úlohy se základní aritmetikou — od začátku
      zlomky:    3,   // Zlomky — hlavní téma 6. třídy, 3. týden
      geometrie: 10,  // Obvod a obsah základních útvarů — polovina 1. pololetí
      procenta:  20,  // Procenta — začátek 2. pololetí
      rovnice:   28,  // Jednoduché lineární rovnice — konec 6. třídy
      grafy:     34   // Grafy a tabulky — závěr roku
    },
    7: {
      slovni:    1,   // Slovní úlohy s celými čísly a poměrem
      zlomky:    1,   // Zlomky — navazující, již probrané v 6.
      procenta:  5,   // Procenta — prohloubení a nové typy, brzy v 7.
      geometrie: 12,  // Trojúhelník, rovnoběžníky, kružnice
      rovnice:   8,   // Lineární rovnice s neznámou ve jmenovateli
      grafy:     22   // Sloupcové a spojnicové grafy, tabulky
    },
    8: {
      slovni:    1,   // Soustavy rovnic ze zadání — hned na začátku
      zlomky:    1,   // Lomené výrazy — prohloubení
      procenta:  1,   // Složené procento, úročení — hned v 8.
      rovnice:   4,   // Soustavy rovnic, nerovnice — 1. měsíc
      geometrie: 12,  // Pythagorova věta, podobnost, povrch a objem těles
      grafy:     18   // Funkce, grafy funkcí, statistika
    },
    9: {
      // 9. třída = přijímačkový rok → vše odemčeno od začátku
      slovni:    1,
      zlomky:    1,
      procenta:  1,
      rovnice:   1,
      geometrie: 1,
      grafy:     1
    }
  };

  // Vrátí pole tema_id, která žák v daném týdnu školního roku již probral
  function getOdemcenaTemata(trida, tydenvRoce) {
    const mapa = SVP_MAP[trida] || SVP_MAP[9];
    return Object.entries(mapa)
      .filter(([, minTyden]) => tydenvRoce >= minTyden)
      .map(([temaId]) => temaId);
  }

  // Vrátí týden školního roku (1–40) z daného Data objektu.
  // Školní rok začíná 1. září; pokud je datum před 1. zářím, patří
  // k předchozímu školnímu roku.
  function getTydenvRoce(datum = new Date()) {
    const rok   = datum.getMonth() >= 8 ? datum.getFullYear() : datum.getFullYear() - 1;
    const start = new Date(rok, 8, 1); // 1. září
    const diff  = datum - start;
    const tyden = Math.ceil(diff / (7 * 24 * 3600 * 1000));
    return Math.max(1, Math.min(40, tyden));
  }

  // Vrátí týden, ve kterém se dané téma odemkne pro danou třídu (pro UI "Probereš v týdnu X")
  function getMinTyden(trida, temaId) {
    return (SVP_MAP[trida] || SVP_MAP[9])[temaId] ?? 1;
  }

  // Vrátí pole odemčených tema_id pro danou třídu (bez ohledu na týden)
  function getOdemcenaTemataPoTridu(trida) {
    const map = TRIDA_TEMATA[trida] || {};
    return Object.entries(map)
      .filter(([, info]) => info.odemceno)
      .map(([temaId]) => temaId);
  }

  // Vrátí filtrované ulohy[] pro dané téma a třídu (dle tridy + podtypu)
  function getUlohyProTridu(temaId, trida) {
    const tema = TEMATA.find(t => t.id === temaId);
    if (!tema) return [];
    const info = TRIDA_TEMATA[trida]?.[temaId];
    if (!info || !info.odemceno) return [];
    const podtypy = info.podtypy || [];
    const jeVse   = podtypy.includes('vse');
    return tema.ulohy.filter(u =>
      !u.vyrazeno && u.tridy?.includes(trida) && (jeVse || podtypy.includes(u.podtyp))
    );
  }

  // Vrátí nejnižší třídu, ve které je téma odemčeno (pro "Dostupné od X. třídy")
  function getMinTrida(temaId) {
    for (const t of [6, 7, 8, 9]) {
      if (TRIDA_TEMATA[t]?.[temaId]?.odemceno) return t;
    }
    return null;
  }

  return {
    getOdemcenaTemata, getTydenvRoce, getMinTyden, SVP_MAP,
    TRIDA_TEMATA, getOdemcenaTemataPoTridu, getUlohyProTridu, getMinTrida
  };
})();
