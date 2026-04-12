// syllabus.js — ŠVP mapa: třída → týden školního roku → odemčená témata

const Syllabus = (() => {

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

  return { getOdemcenaTemata, getTydenvRoce, getMinTyden, SVP_MAP };
})();
