// ulohy.js — 27 úloh pro přípravu na přijímačky (CERMAT, 4leté obory)

function normalizuj(vstup) {
  return vstup.trim().replace(/\s+/g, ' ').replace(',', '.').toLowerCase();
}

function cislo(vstup) {
  return parseFloat(normalizuj(vstup).replace(/[^0-9.\-]/g, ''));
}

function blizko(vstup, spravne, tolerance) {
  const tol = tolerance !== undefined ? tolerance : 0.05;
  const v = cislo(vstup);
  if (isNaN(v)) return false;
  return Math.abs(v - spravne) <= Math.abs(spravne) * tol + 0.001;
}

const TEMATA = [
  // ─────────────────────────────────────────────
  // 1. SLOVNÍ ÚLOHY
  // ─────────────────────────────────────────────
  {
    id: 'slovni',
    nazev: 'Slovní úlohy',
    ikona: '📝',
    popis: 'Pojmenování neznámé, sestavení rovnic ze zadání, soustavy',
    ulohy: [
      {
        id: 's1',
        zadani: 'Petr má o 15 více knížek než Jana. Dohromady mají 63 knížek. Kolik knížek má každý z nich?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako x. (Nápověda: Kolik knížek má Jana?)',
          'Jana má x knížek. Kolik má pak Petr? Zapiš výraz pomocí x.',
          'Sestav rovnici: x + (x + 15) = 63. Upravena dostaneme 2x + 15 = 63. Kolik je 2x?',
          'Z 2x = 48 urči x. Jana má tedy kolik knížek? A Petr?'
        ],
        odpoved: 'Jana má 24 knížek, Petr má 39 knížek.',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('24') && n.includes('39')) || blizko(vstup, 24);
        }
      },
      {
        id: 's2',
        zadani: 'Vlak ujede za 3 hodiny stejnou vzdálenost jako autobus za 4 hodiny. Autobus jede rychlostí 90 km/h. Jakou rychlostí jede vlak?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako x. (Rychlost vlaku = x km/h.)',
          'Vzdálenost = rychlost × čas. Zapiš vzdálenost vlaku a vzdálenost autobusu pomocí vzorce.',
          'Vzdálenosti jsou stejné: 3x = 4 · 90. Vypočítej pravou stranu rovnice.',
          'Z rovnice 3x = 360 urči x. Jaká je tedy rychlost vlaku?'
        ],
        odpoved: '120 km/h',
        jednotka: 'km/h',
        kontrola: (vstup) => blizko(vstup, 120, 0.01)
      },
      {
        id: 's3',
        zadani: 'Zahrada má tvar obdélníku. Její délka je o 8 m větší než šířka. Obvod zahrady je 56 m. Jaké jsou rozměry zahrady?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako x. (Šířka = x m, délka = ?)',
          'Délka je o 8 m větší než šířka. Zapiš délku pomocí x.',
          'Obvod obdélníku = 2 · (délka + šířka). Sestav rovnici: 2(x + x + 8) = 56.',
          'Zjednodušíme: 2(2x + 8) = 56 → 4x + 16 = 56 → 4x = 40. Kolik je x?',
          'Šířka = x = 10 m, délka = x + 8 = ? m.'
        ],
        odpoved: 'Šířka 10 m, délka 18 m.',
        jednotka: 'm',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('10') && n.includes('18')) || blizko(vstup, 10) || blizko(vstup, 18);
        }
      },
      {
        id: 's4',
        zadani: 'Ve třídě je 30 žáků. Chlapců je o 4 více než dívek. Kolik je ve třídě chlapců a kolik dívek?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako x. (Počet dívek = x.)',
          'Počet chlapců vyjádři pomocí x.',
          'Sestav rovnici pro celkový počet žáků: x + (x + 4) = 30.',
          'Vyřeš rovnici: 2x + 4 = 30 → 2x = 26 → x = ?',
          'Dívek je x = 13. Chlapců je x + 4 = ?'
        ],
        odpoved: '13 dívek, 17 chlapců.',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('13') && n.includes('17')) || blizko(vstup, 13) || blizko(vstup, 17);
        }
      },
      {
        id: 's5',
        zadani: 'Dva dělníci spolu opraví střechu za 6 dní. Pracují-li samostatně, první ji opraví za 10 dní. Za kolik dní ji opraví druhý dělník sám?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako x. (Druhý dělník opraví střechu za x dní.)',
          'Výkon za den: první dělník = 1/10 střechy/den, druhý = 1/x střechy/den. Jak zapíšeš jejich společný denní výkon?',
          'Spolu opraví za 6 dní celou střechu: (1/10 + 1/x) · 6 = 1. Rozviň rovnici.',
          '6/10 + 6/x = 1 → 6/x = 1 − 3/5 = 2/5. Kolik je x?',
          'Z 6/x = 2/5 → x = 6 · 5 / 2 = ?'
        ],
        odpoved: '15 dní',
        jednotka: 'dní',
        kontrola: (vstup) => blizko(vstup, 15, 0.01)
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 2. PROCENTA
  // ─────────────────────────────────────────────
  {
    id: 'procenta',
    nazev: 'Procenta',
    ikona: '%',
    popis: 'Zpětný výpočet, složené změny, jednoduché úročení',
    ulohy: [
      {
        id: 'p1',
        zadani: 'Po slevě 20 % stál svetr 480 Kč. Jaká byla původní cena svetru?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako x. (Původní cena = x Kč.)',
          'Po slevě 20 % zaplatíme kolik procent původní ceny? Zapiš jako zlomek nebo desetinné číslo.',
          'Rovnice: 0,8 · x = 480. Jak z ní vyjádříš x?',
          'x = 480 / 0,8 = ? Kč'
        ],
        odpoved: '600 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 600, 0.01)
      },
      {
        id: 'p2',
        zadani: 'Cena benzínu vzrostla o 10 % a pak ještě o dalších 10 %. O kolik procent celkem vzrostla cena oproti původní ceně?',
        kroky: [
          'Začneme s cenou 100 Kč. Po prvním zdražení o 10 % je nová cena kolik?',
          'Tuto novou cenu (110 Kč) zvedneme o dalších 10 %. Nová cena = 110 · 1,1 = ? Kč',
          'Celkový nárůst = výsledná cena − původní cena. Kolik to je v Kč (při základní ceně 100 Kč)?',
          'Vyjádři celkový nárůst v procentech oproti původní ceně 100 Kč.'
        ],
        odpoved: '21 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 21, 0.01)
      },
      {
        id: 'p3',
        zadani: 'Ve třídě je 24 žáků. 25 % z nich jsou vyznamenanci. Kolik žáků dostane vyznamenání?',
        kroky: [
          '25 % lze zapsat jako zlomek. Jaký zlomek to je?',
          'Vypočítej 25 % z 24: (25/100) · 24 = ? nebo (1/4) · 24 = ?'
        ],
        odpoved: '6 žáků',
        jednotka: 'žáků',
        kontrola: (vstup) => blizko(vstup, 6, 0.01)
      },
      {
        id: 'p4',
        zadani: 'Banka nabízí roční úrokovou sazbu 3 %. Kolik korun vydělá 5 000 Kč za 2 roky (jednoduché úročení)?',
        kroky: [
          'Jednoduché úročení: úrok za rok = jistina · úroková sazba. Kolik vydělá 5 000 Kč za 1 rok?',
          'Za 2 roky je úrok 2× větší. Kolik to je?',
          'Celková částka = jistina + úrok = 5 000 + ? = ?'
        ],
        odpoved: 'Úrok 300 Kč, celkem 5 300 Kč.',
        jednotka: 'Kč',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return blizko(vstup, 300, 0.01) || blizko(vstup, 5300, 0.01) || (n.includes('300') || n.includes('5300') || n.includes('5 300'));
        }
      },
      {
        id: 'p5',
        zadani: 'Výrobek zdražel o 15 % na cenu 1 150 Kč. Jaká byla původní cena?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako x. (Původní cena = x Kč.)',
          'Po zdražení o 15 % je nová cena x · 1,15. Zapiš rovnici.',
          'Rovnice: 1,15 · x = 1 150. Jak z ní vyjádříš x?',
          'x = 1 150 / 1,15 = ?'
        ],
        odpoved: '1 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 1000, 0.01)
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 3. ZLOMKY
  // ─────────────────────────────────────────────
  {
    id: 'zlomky',
    nazev: 'Zlomky',
    ikona: '½',
    popis: 'Operace se zlomky, základní tvar, kombinované výrazy',
    ulohy: [
      {
        id: 'z1',
        zadani: 'Vypočítej: 3/4 + 2/3',
        kroky: [
          'Pro sčítání zlomků potřebuješ společného jmenovatele. Jaký je nejmenší společný násobek čísel 4 a 3?',
          'Převeď oba zlomky na jmenovatele 12: 3/4 = ?/12 a 2/3 = ?/12.',
          'Teď sečti: ?/12 + ?/12 = ?/12. Lze výsledek zkrátit?'
        ],
        odpoved: '17/12 (nebo 1 a 5/12)',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('17/12') || n.includes('17 / 12') || blizko(vstup, 17/12) || n.includes('1 5/12') || n.includes('1 a 5/12');
        }
      },
      {
        id: 'z2',
        zadani: 'Zjednoduš zlomek 36/48 na základní tvar.',
        kroky: [
          'Najdi největšího společného dělitele (NSD) čísel 36 a 48. Jaká čísla dělí beze zbytku obě čísla?',
          'NSD(36, 48) = 12. Vydělej čitatele i jmenovatele číslem 12: 36 ÷ 12 = ?, 48 ÷ 12 = ?',
          'Výsledný zlomek v základním tvaru je ?/? Lze ho ještě zkrátit?'
        ],
        odpoved: '3/4',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('3/4') || n.includes('3 / 4') || blizko(vstup, 0.75);
        }
      },
      {
        id: 'z3',
        zadani: 'Vypočítej: (2/5) · (15/8)',
        kroky: [
          'Zlomky násobíme čitatel krát čitatel a jmenovatel krát jmenovatel. Zapíšeme: (2 · 15) / (5 · 8) = ?',
          'Výsledek je 30/40. Zjednodušíme: jaký je NSD(30, 40)?',
          'NSD = 10. Vydělíme: 30/40 = ?/4. Zkontroluj, jestli je výsledek v základním tvaru.'
        ],
        odpoved: '3/4',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('3/4') || n.includes('3 / 4') || blizko(vstup, 0.75);
        }
      },
      {
        id: 'z4',
        zadani: 'Vypočítej: 5/6 − 1/4',
        kroky: [
          'Najdi nejmenší společný násobek čísel 6 a 4.',
          'NSN(6, 4) = 12. Převeď: 5/6 = ?/12 a 1/4 = ?/12.',
          'Odečti: ?/12 − ?/12 = ?/12. Zjednodušíme?'
        ],
        odpoved: '7/12',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('7/12') || n.includes('7 / 12') || blizko(vstup, 7/12);
        }
      },
      {
        id: 'z5',
        zadani: 'Vypočítej: (3/4) ÷ (9/16)',
        kroky: [
          'Dělení zlomků: místo dělení násobíme převrácenou hodnotou. Jaká je převrácená hodnota zlomku 9/16?',
          'Nyní násobíme: (3/4) · (16/9) = (3 · 16) / (4 · 9) = ?/? ',
          'Zjednodušíme 48/36: NSD(48, 36) = 12. Vydělíme: 48/36 = ?/3. Zkontroluj základní tvar.'
        ],
        odpoved: '4/3 (nebo 1 a 1/3)',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('4/3') || n.includes('4 / 3') || blizko(vstup, 4/3) || n.includes('1 1/3') || n.includes('1 a 1/3');
        }
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 4. ROVNICE
  // ─────────────────────────────────────────────
  {
    id: 'rovnice',
    nazev: 'Rovnice',
    ikona: '⚖️',
    popis: 'Lineární rovnice, soustavy, rozklad, absolutní hodnota',
    ulohy: [
      {
        id: 'r1',
        zadani: 'Vyřeš rovnici: 3(x − 4) = 2x + 1',
        kroky: [
          'Rozbal závorku na levé straně: 3(x − 4) = ?',
          'Dostali jsme: 3x − 12 = 2x + 1. Přesuň členy s x na levou stranu a čísla na pravou.',
          '3x − 2x = 1 + 12 → x = ?'
        ],
        odpoved: 'x = 13',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 13, 0.01)
      },
      {
        id: 'r2',
        zadani: 'Vyřeš soustavu rovnic:\n2x + y = 7\nx − y = 2',
        kroky: [
          'Použijeme metodu sčítání. Co se stane, když sečteme obě rovnice? (2x + y) + (x − y) = 7 + 2',
          'Výsledek: 3x = 9. Kolik je x?',
          'Dosaď x = 3 do druhé rovnice: 3 − y = 2. Kolik je y?',
          'Zkontroluj výsledek x = 3, y = 1 v první rovnici: 2·3 + 1 = ?'
        ],
        odpoved: 'x = 3, y = 1',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('x = 3') || n.includes('x=3') || n.includes('3')) && (n.includes('y = 1') || n.includes('y=1') || n.includes('1'));
        }
      },
      {
        id: 'r3',
        zadani: 'Rozlož na součin: x² − 9',
        kroky: [
          'Výraz x² − 9 je rozdíl čtverců. Platí vzorec: a² − b² = (a + b)(a − b). Jaké je a a jaké je b v tomto výrazu?',
          'a = x (protože a² = x²) a b = 3 (protože b² = 9). Dosaď do vzorce.',
          'Výsledný rozklad: (x + 3)(x − 3). Zkontroluj roznásobením.'
        ],
        odpoved: '(x + 3)(x − 3)',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup).replace(/\s/g, '');
          return n.includes('(x+3)(x-3)') || n.includes('(x-3)(x+3)') || (n.includes('x+3') && n.includes('x-3'));
        }
      },
      {
        id: 'r4',
        zadani: 'Vyřeš nerovnici: 2x − 3 > 5',
        kroky: [
          'Přičti 3 k oběma stranám nerovnice. Co dostaneš?',
          '2x > 8. Vydel obě strany číslem 2. Co dostaneš? (Pozor — při dělení kladným číslem se znaménko nemění.)',
          'Výsledek je x > ?. Zapíš řešení jako interval nebo nerovnici.'
        ],
        odpoved: 'x > 4',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('x > 4') || n.includes('x>4') || n.includes('(4, ∞)') || n.includes('(4, inf)') || n.includes('4; ∞') || blizko(vstup, 4, 0.01);
        }
      },
      {
        id: 'r5',
        zadani: 'Vyřeš rovnici s absolutní hodnotou: |2x − 4| = 6',
        kroky: [
          'Absolutní hodnota výrazu může být kladná nebo záporná. Rovnice |A| = 6 má dvě řešení: A = 6 nebo A = −6. Zapiš obě rovnice pro výraz 2x − 4.',
          'Vyřeš první rovnici: 2x − 4 = 6 → 2x = ? → x = ?',
          'Vyřeš druhou rovnici: 2x − 4 = −6 → 2x = ? → x = ?',
          'Výsledky jsou x = 5 a x = −1. Zkontroluj oba v původní rovnici.'
        ],
        odpoved: 'x = 5 nebo x = −1',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('5') && (n.includes('-1') || n.includes('−1'))) || blizko(vstup, 5, 0.01) || blizko(vstup, -1, 0.01);
        }
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 5. GEOMETRIE
  // ─────────────────────────────────────────────
  {
    id: 'geometrie',
    nazev: 'Geometrie',
    ikona: '📐',
    popis: 'Pythagorova věta, obsah, obvod, složené útvary',
    ulohy: [
      {
        id: 'g1',
        zadani: 'Pravoúhlý trojúhelník má odvěsny délky 6 cm a 8 cm. Jaká je délka přepony?',
        kroky: [
          'Zapiš Pythagorovu větu: c² = a² + b², kde c je přepona a a, b jsou odvěsny.',
          'Dosaď: c² = 6² + 8² = ? + ? = ?',
          'c² = 100. Kolik je c? (Vzpomeň si, co je druhá odmocnina.)'
        ],
        odpoved: '10 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 10, 0.01)
      },
      {
        id: 'g2',
        zadani: 'Čtverec má obsah 64 cm². Jaký je jeho obvod?',
        kroky: [
          'Obsah čtverce S = a². Víme, že a² = 64. Jaká je délka strany a?',
          'Obvod čtverce O = 4 · a. Dosaď a = 8 cm a vypočítej obvod.',
        ],
        odpoved: '32 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 32, 0.01)
      },
      {
        id: 'g3',
        zadani: 'Kruh má poloměr 5 cm. Vypočítej jeho obvod (používej π ≈ 3,14).',
        kroky: [
          'Vzorec pro obvod kruhu: O = 2 · π · r. Jaký je poloměr r?',
          'Dosaď: O = 2 · 3,14 · 5 = ?',
        ],
        odpoved: '31,4 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 31.4, 0.02)
      },
      {
        id: 'g4',
        zadani: 'Složený útvar se skládá z obdélníku 10 × 6 cm, na jehož kratší straně sedí trojúhelník s výškou 4 cm. Jaký je celkový obsah útvaru?',
        kroky: [
          'Rozděl útvar na obdélník a trojúhelník. Jaký je obsah obdélníku (10 × 6 cm)?',
          'Obsah trojúhelníku: S = (základna · výška) / 2. Základna trojúhelníku = kratší strana obdélníku = 6 cm, výška = 4 cm. Vypočítej obsah trojúhelníku.',
          'Celkový obsah = obsah obdélníku + obsah trojúhelníku = ? + ? = ?'
        ],
        odpoved: '72 cm²',
        jednotka: 'cm²',
        kontrola: (vstup) => blizko(vstup, 72, 0.01)
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 6. GRAFY A TABULKY
  // ─────────────────────────────────────────────
  {
    id: 'grafy',
    nazev: 'Grafy a tabulky',
    ikona: '📊',
    popis: 'Čtení dat, průměry, procentní změny z grafů',
    ulohy: [
      {
        id: 'gr1',
        zadani: 'Tabulka uvádí teploty (°C) naměřené v pondělí až pátek: 12, 15, 11, 17, 10. Jaký je průměr teplot za tyto dny?',
        kroky: [
          'Průměr = součet hodnot / počet hodnot. Nejdřív spočítej součet: 12 + 15 + 11 + 17 + 10 = ?',
          'Počet dnů je 5. Vydel součet počtem hodnot: průměr = 65 / 5 = ?'
        ],
        odpoved: '13 °C',
        jednotka: '°C',
        kontrola: (vstup) => blizko(vstup, 13, 0.01)
      },
      {
        id: 'gr2',
        zadani: 'Graf ukazuje, že loni bylo prodáno 400 kusů výrobku a letos 520 kusů. O kolik procent vzrostl prodej?',
        kroky: [
          'Procentní změna = (nová hodnota − původní hodnota) / původní hodnota · 100 %. Zapiš hodnoty.',
          'Rozdíl = 520 − 400 = ? kusů.',
          'Procentní nárůst = (120 / 400) · 100 = ? %'
        ],
        odpoved: '30 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 30, 0.01)
      },
      {
        id: 'gr3',
        zadani: 'Koláčový graf zobrazuje strukturu výdajů domácnosti. Potraviny tvoří 35 %, nájem 40 %, ostatní 25 %. Celkové výdaje jsou 20 000 Kč. Kolik korun tvoří výdaje za nájem?',
        kroky: [
          'Nájem tvoří 40 % z celkových výdajů. Zapiš jako výpočet: ? % z 20 000 Kč.',
          '40 % = 40/100 = 0,4. Vypočítej: 0,4 · 20 000 = ? Kč.'
        ],
        odpoved: '8 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 8000, 0.01)
      }
    ]
  }
];
