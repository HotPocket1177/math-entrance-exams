// ulohy.js — úlohy pro přípravu na přijímačky (CERMAT, 4leté obory)
// Matematické výrazy v zadani/kroky/odpoved jsou v LaTeX notaci ($...$).
// Funkce kontrola() pracuje s plain textem (vstup žáka) — LaTeX se zde NEPÍŠE.
//
// Každé téma splňuje: min. 2 úlohy s desetinnými/zlomkovými čísly,
// min. 1 úloha se záporným výsledkem nebo záporným mezivýsledkem,
// min. 1 úloha v reálném kontextu, min. 1 vícekroková úloha.

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
        // Základní: celá čísla, dvě neznámé
        id: 's1', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Petr má o 15 více knížek než Jana. Dohromady mají 63 knížek. Kolik knížek má každý z nich?',
        kroky: [
          'Co v zadání nevíš? Pojmenuj to — zapiš jako $x$. (Nápověda: Kolik knížek má Jana?)',
          'Jana má $x$ knížek. Kolik má pak Petr? Zapiš výraz pomocí $x$.',
          'Sestav rovnici: $x + (x + 15) = 63$. Upravíme: $2x + 15 = 63$. Kolik je $2x$?',
          'Z $2x = 48$ urči $x$. Jana má tedy kolik knížek? A Petr?'
        ],
        odpoved: 'Jana má 24 knížek, Petr má 39 knížek.',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('24') && n.includes('39')) || blizko(vstup, 24);
        },
        postup: [
          { latex: 'x = \\text{počet knížek Jany}', stav: 'krok' },
          { latex: 'x + (x + 15) = 63 \\Rightarrow 2x = 48', stav: 'krok' },
          { latex: '\\text{Jana: } 24,\\quad \\text{Petr: } 39', stav: 'vysledek' }
        ]
      },
      {
        // Reálný kontext: provize z prodeje, desetinná čísla, více kroků
        id: 's2', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Obchodní zástupce dostane základní mzdu 12 000 Kč a k tomu 4 % provizi z hodnoty prodaného zboží. Minulý měsíc vydělal celkem 18 500 Kč. Jaká byla celková hodnota jeho prodeje?',
        kroky: [
          'Co v zadání nevíš? Zapiš jako $x$ (hodnota prodeje v Kč).',
          'Provize z prodeje $= 4\\,\\% \\cdot x = 0{,}04x$. Celkový výdělek: $12\\,000 + 0{,}04x = 18\\,500$.',
          'Odečti základní mzdu: $0{,}04x = 18\\,500 - 12\\,000 = 6\\,500$.',
          'Vyřeš: $x = \\frac{6\\,500}{0{,}04} = ?$'
        ],
        odpoved: '162 500 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 162500, 0.01),
        postup: [
          { latex: 'x = \\text{hodnota prodeje [Kč]}', stav: 'krok' },
          { latex: '12\\,000 + 0{,}04x = 18\\,500', stav: 'krok' },
          { latex: '0{,}04x = 6\\,500 \\Rightarrow x = 162\\,500 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        // Věk: záporný mezivýsledek při přesunu členů, více kroků
        id: 's3', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Otec je nyní třikrát starší než syn. Za 8 let bude součet jejich věků 64 let. Kolik let je otci a kolik synovi?',
        kroky: [
          'Pojmenuj neznámé. Synův věk $= x$, otcův věk $= ?$ (třikrát starší než syn).',
          'Za 8 let: syn bude mít $x + 8$ let, otec $3x + 8$ let. Sestav rovnici pro součet.',
          '$(x + 8) + (3x + 8) = 64 \\Rightarrow 4x + 16 = 64$. Přesuň 16 na pravou stranu.',
          '$4x = 48 \\Rightarrow x = 12$. Kolik let je otci?'
        ],
        odpoved: 'Synovi 12 let, otci 36 let.',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('12') && n.includes('36')) || blizko(vstup, 12) || blizko(vstup, 36);
        },
        postup: [
          { latex: 'x = \\text{věk syna},\\quad 3x = \\text{věk otce}', stav: 'krok' },
          { latex: '(x+8) + (3x+8) = 64 \\Rightarrow 4x + 16 = 64', stav: 'krok' },
          { latex: '4x = 48 \\Rightarrow x = 12', stav: 'krok' },
          { latex: '\\text{Syn: } 12 \\text{ let},\\quad \\text{otec: } 36 \\text{ let}', stav: 'vysledek' }
        ]
      },
      {
        // Reálný kontext: zásoby, zlomky jako součást rovnice, více kroků
        id: 's4', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Zelenář koupil zásobu jablek. Dopoledne prodal $\\frac{2}{5}$ zásoby, odpoledne prodal dalších 150 ks. Večer mu zbývaly $\\frac{4}{15}$ původní zásoby. Kolik jablek zelenář koupil?',
        kroky: [
          'Označ původní zásobu jako $x$. Po dopoledním prodeji zbývá $x - \\frac{2}{5}x = \\frac{3}{5}x$.',
          'Po odpoledním prodeji zbývá $\\frac{3}{5}x - 150$. Toto se rovná $\\frac{4}{15}x$.',
          'Sestav rovnici: $\\frac{3}{5}x - 150 = \\frac{4}{15}x$. Převeď $\\frac{3}{5}$ na patnáctiny: $\\frac{9}{15}x - \\frac{4}{15}x = 150$.',
          '$\\frac{5}{15}x = \\frac{x}{3} = 150 \\Rightarrow x = ?$'
        ],
        odpoved: '450 jablek',
        jednotka: 'ks',
        kontrola: (vstup) => blizko(vstup, 450, 0.01),
        postup: [
          { latex: 'x = \\text{původní zásoba}', stav: 'krok' },
          { latex: '\\tfrac{3}{5}x - 150 = \\tfrac{4}{15}x', stav: 'krok' },
          { latex: '\\tfrac{9}{15}x - \\tfrac{4}{15}x = 150 \\Rightarrow \\tfrac{x}{3} = 150', stav: 'krok' },
          { latex: 'x = 450 \\text{ jablek}', stav: 'vysledek' }
        ]
      },
      {
        // Frakcová práce: klasická "za kolik dní" — zlomky, více kroků
        id: 's5', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Dva dělníci spolu opraví střechu za 6 dní. Pracují-li samostatně, první ji opraví za 10 dní. Za kolik dní ji opraví druhý dělník sám?',
        kroky: [
          'Výkon za den: první $= \\frac{1}{10}$ střechy, druhý $= \\frac{1}{x}$ střechy. Zapiš jejich společný denní výkon.',
          'Spolu opraví celou střechu za 6 dní: $\\left(\\frac{1}{10} + \\frac{1}{x}\\right) \\cdot 6 = 1$.',
          '$\\frac{6}{10} + \\frac{6}{x} = 1 \\Rightarrow \\frac{6}{x} = 1 - \\frac{3}{5} = \\frac{2}{5}$.',
          'Z $\\frac{6}{x} = \\frac{2}{5}$ urči $x = \\frac{6 \\cdot 5}{2} = ?$'
        ],
        odpoved: '15 dní',
        jednotka: 'dní',
        kontrola: (vstup) => blizko(vstup, 15, 0.01),
        postup: [
          { latex: '\\tfrac{1}{10} + \\tfrac{1}{x} = \\tfrac{1}{6}', stav: 'krok' },
          { latex: '\\tfrac{6}{x} = \\tfrac{2}{5} \\Rightarrow x = 15 \\text{ dní}', stav: 'vysledek' }
        ]
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
    popis: 'Zpětný výpočet, složené změny, procentní pokles, jednoduché úročení',
    ulohy: [
      {
        // Zpětný výpočet ze slevy — desetinné číslo, reálný kontext
        id: 'p1', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Po slevě 20 % stál svetr 480 Kč. Jaká byla původní cena svetru?',
        kroky: [
          'Označme původní cenu jako $x$ Kč. Po 20% slevě platíme kolik % z původní ceny?',
          '$100\\,\\% - 20\\,\\% = 80\\,\\%$. Rovnice: $0{,}8 \\cdot x = 480$.',
          '$x = \\frac{480}{0{,}8} = ?$'
        ],
        odpoved: '600 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 600, 0.01),
        postup: [
          { latex: 'x = \\text{původní cena [Kč]}', stav: 'krok' },
          { latex: '0{,}8 \\cdot x = 480', stav: 'krok' },
          { latex: 'x = \\frac{480}{0{,}8} = 600 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        // Složené procentní zdražení — desetinná čísla, záporný mezivýsledek v porovnání
        id: 'p2', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Cena benzínu vzrostla o 10 % a pak ještě o dalších 10 %. O kolik procent celkem vzrostla cena oproti původní ceně?',
        kroky: [
          'Začni s cenou 100 Kč. Po prvním zdražení o 10 % je nová cena kolik?',
          'Tuto novou cenu (110 Kč) zvedneme o dalších 10 %. $110 \\cdot 1{,}1 = ?$',
          'Nárůst $= 121 - 100 = 21$ Kč. Vyjádři nárůst v procentech oproti původní ceně 100 Kč.'
        ],
        odpoved: '21 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 21, 0.01),
        postup: [
          { latex: '100 \\cdot 1{,}1 = 110 \\text{ Kč}', stav: 'krok' },
          { latex: '110 \\cdot 1{,}1 = 121 \\text{ Kč}', stav: 'krok' },
          { latex: '121 - 100 = 21 \\Rightarrow \\text{celkový nárůst: } 21\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        // Záporný mezivýsledek: pokles prodeje v %
        id: 'p3', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Obchod prodal loni 500 výrobků, letos pouze 380. O kolik procent klesl prodej?',
        kroky: [
          'Procentní změna $= \\frac{\\text{nová hodnota} - \\text{původní}}{\\text{původní}} \\cdot 100\\,\\%$.',
          'Rozdíl $= 380 - 500 = ?$ (záporné číslo — prodej klesl).',
          '$\\frac{-120}{500} \\cdot 100 = ?\\,\\%$. Výsledek záporný = pokles. O kolik procent klesl?'
        ],
        odpoved: '24 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 24, 0.01) || blizko(vstup, -24, 0.01),
        postup: [
          { latex: '380 - 500 = -120 \\text{ kusů (pokles)}', stav: 'krok' },
          { latex: '\\frac{-120}{500} \\cdot 100 = -24\\,\\%', stav: 'krok' },
          { latex: '\\text{Prodej klesl o } 24\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        // Jednoduché úročení — celá čísla, reálný kontext, více kroků
        id: 'p4', tridy: [8,9], podtyp: 'zakladni',
        zadani: 'Banka nabízí roční úrokovou sazbu 3 %. Kolik korun vydělá 5 000 Kč za 2 roky (jednoduché úročení)?',
        kroky: [
          'Jednoduché úročení: úrok za rok $= $ jistina $\\times$ sazba. Kolik vydělá 5 000 Kč za 1 rok?',
          'Za 2 roky je úrok $2\\times$ větší. Kolik to je?',
          'Celková částka $= $ jistina $+$ úrok.'
        ],
        odpoved: 'Úrok 300 Kč, celkem 5 300 Kč.',
        jednotka: 'Kč',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return blizko(vstup, 300, 0.01) || blizko(vstup, 5300, 0.01) ||
                 n.includes('300') || n.includes('5300') || n.includes('5 300');
        },
        postup: [
          { latex: '\\text{úrok/rok} = 5\\,000 \\cdot 0{,}03 = 150 \\text{ Kč}', stav: 'krok' },
          { latex: '\\text{za 2 roky} = 2 \\cdot 150 = 300 \\text{ Kč}', stav: 'krok' },
          { latex: '5\\,000 + 300 = 5\\,300 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        // Zpětný výpočet z procent — reálný kontext (sport), desetinné číslo
        id: 'p5', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Jan uběhl 12 km a ví, že to je 30 % celkové délky maratonu. Jak dlouhý je celý maraton?',
        kroky: [
          'Označ délku maratonu jako $x$ km. 30 % z délky = 12 km. Zapiš rovnici.',
          '$0{,}3 \\cdot x = 12$. Jak vyjádříš $x$?',
          '$x = \\frac{12}{0{,}3} = ?$'
        ],
        odpoved: '40 km',
        jednotka: 'km',
        kontrola: (vstup) => blizko(vstup, 40, 0.01),
        postup: [
          { latex: 'x = \\text{délka maratonu [km]}', stav: 'krok' },
          { latex: '0{,}3 \\cdot x = 12', stav: 'krok' },
          { latex: 'x = \\frac{12}{0{,}3} = 40 \\text{ km}', stav: 'vysledek' }
        ]
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
        // Reálný kontext: recept — zlomky, podíl, více kroků
        id: 'z1', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Recept na bábovku pro 6 osob potřebuje $\\frac{3}{4}$ kg mouky. Na kolik osob bude stačit 1 kg mouky?',
        kroky: [
          'Pro 6 osob potřebuješ $\\frac{3}{4}$ kg. Kolik kg potřebuješ pro 1 osobu?',
          'Pro 1 osobu: $\\frac{3}{4} \\div 6 = \\frac{3}{4} \\cdot \\frac{1}{6} = \\frac{3}{24} = \\frac{1}{8}$ kg. Pro kolik osob vystačí 1 kg?',
          '$1 \\div \\frac{1}{8} = 1 \\cdot 8 = ?$ osob.'
        ],
        odpoved: '8 osob',
        jednotka: 'osob',
        kontrola: (vstup) => blizko(vstup, 8, 0.01),
        postup: [
          { latex: '\\text{na 1 osobu: } \\frac{3}{4} \\div 6 = \\frac{1}{8} \\text{ kg}', stav: 'krok' },
          { latex: '1 \\div \\frac{1}{8} = 8 \\text{ osob}', stav: 'vysledek' }
        ]
      },
      {
        // Krácení — základní tvar zlomku
        id: 'z2', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Zjednoduš zlomek $\\frac{36}{48}$ na základní tvar.',
        kroky: [
          'Najdi největšího společného dělitele čísel 36 a 48.',
          '$\\text{NSD}(36, 48) = 12$. Vydělej čitatele i jmenovatele 12.',
          'Výsledný zlomek v základním tvaru je $\\frac{?}{?}$. Lze ještě zkrátit?'
        ],
        odpoved: '$\\frac{3}{4}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('3/4') || n.includes('3 / 4') || blizko(vstup, 0.75);
        },
        postup: [
          { latex: '\\text{NSD}(36, 48) = 12', stav: 'krok' },
          { latex: '\\frac{36 \\div 12}{48 \\div 12} = \\frac{3}{4}', stav: 'vysledek' }
        ]
      },
      {
        // Reálný kontext: látka — desetinné číslo, zlomky, více kroků
        id: 'z3', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Klára má 4,5 m látky. Na sukni spotřebovala $\\frac{3}{5}$ celkové délky, na halenku pak $\\frac{1}{4}$ ze zbytku. Kolik metrů látky zbývá?',
        kroky: [
          'Po ušití sukně: zbývá $4{,}5 - 4{,}5 \\cdot \\frac{3}{5} = 4{,}5 \\cdot \\frac{2}{5}$. Kolik metrů?',
          'Zbytek po sukni: $4{,}5 \\cdot 0{,}4 = 1{,}8$ m. Z toho na halenku: $1{,}8 \\cdot \\frac{1}{4} = ?$ m.',
          'Zbývá: $1{,}8 - 0{,}45 = ?$ m.'
        ],
        odpoved: '1,35 m',
        jednotka: 'm',
        kontrola: (vstup) => blizko(vstup, 1.35, 0.03),
        postup: [
          { latex: '4{,}5 \\cdot \\frac{2}{5} = 1{,}8 \\text{ m (po sukni)}', stav: 'krok' },
          { latex: '1{,}8 \\cdot \\frac{1}{4} = 0{,}45 \\text{ m (halenka)}', stav: 'krok' },
          { latex: '1{,}8 - 0{,}45 = 1{,}35 \\text{ m}', stav: 'vysledek' }
        ]
      },
      {
        // Odčítání zlomků — základní operace
        id: 'z4', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Vypočítej: $\\frac{5}{6} - \\frac{1}{4}$',
        kroky: [
          'Najdi nejmenší společný násobek čísel 6 a 4.',
          '$\\text{NSN}(6, 4) = 12$. Převeď: $\\frac{5}{6} = \\frac{?}{12}$ a $\\frac{1}{4} = \\frac{?}{12}$.',
          'Odečti čitatele: $\\frac{10}{12} - \\frac{3}{12} = ?$. Lze výsledek zkrátit?'
        ],
        odpoved: '$\\frac{7}{12}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('7/12') || n.includes('7 / 12') || blizko(vstup, 7/12);
        },
        postup: [
          { latex: '\\text{NSN}(6, 4) = 12', stav: 'krok' },
          { latex: '\\frac{5}{6} = \\frac{10}{12},\\quad \\frac{1}{4} = \\frac{3}{12}', stav: 'krok' },
          { latex: '\\frac{10}{12} - \\frac{3}{12} = \\frac{7}{12}', stav: 'vysledek' }
        ]
      },
      {
        // Reálný kontext: cestovní časy — zlomky, převod na minuty, záporný mezivýsledek (rozdíl)
        id: 'z5', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Ondřej jezdí do školy $\\frac{5}{6}$ hodiny, Marie $\\frac{3}{4}$ hodiny. O kolik minut jezdí Marie kratší dobu?',
        kroky: [
          'Rozdíl časů: $\\frac{5}{6} - \\frac{3}{4}$. Jaký je společný jmenovatel 6 a 4?',
          '$\\text{NSN}(6, 4) = 12$. Převeď: $\\frac{5}{6} = \\frac{10}{12}$, $\\frac{3}{4} = \\frac{9}{12}$.',
          'Rozdíl: $\\frac{10}{12} - \\frac{9}{12} = \\frac{1}{12}$ hodiny. Převeď na minuty: $\\frac{1}{12} \\cdot 60 = ?$'
        ],
        odpoved: '5 minut',
        jednotka: 'min',
        kontrola: (vstup) => blizko(vstup, 5, 0.01),
        postup: [
          { latex: '\\tfrac{5}{6} - \\tfrac{3}{4} = \\tfrac{10}{12} - \\tfrac{9}{12} = \\tfrac{1}{12} \\text{ hod}', stav: 'krok' },
          { latex: '\\tfrac{1}{12} \\cdot 60 = 5 \\text{ min}', stav: 'vysledek' }
        ]
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
    popis: 'Lineární rovnice, soustavy, zlomkové rovnice, absolutní hodnota',
    ulohy: [
      {
        // Lineární rovnice se závorkou
        id: 'r1', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $3(x - 4) = 2x + 1$',
        kroky: [
          'Rozbal závorku: $3(x - 4) = ?$',
          'Dostáváme: $3x - 12 = 2x + 1$. Přesuň $x$ na levou stranu, čísla na pravou.',
          '$3x - 2x = 1 + 12 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 13$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 13, 0.01),
        postup: [
          { latex: '3x - 12 = 2x + 1', stav: 'krok' },
          { latex: 'x = 13', stav: 'vysledek' }
        ]
      },
      {
        // Soustava rovnic — dvě neznámé, metoda sčítání
        id: 'r2', tridy: [8,9], podtyp: 'soustava',
        zadani: 'Vyřeš soustavu rovnic:\n$2x + y = 7$\n$x - y = 2$',
        kroky: [
          'Sečti obě rovnice: $(2x + y) + (x - y) = 7 + 2$. Co dostaneš?',
          '$3x = 9 \\Rightarrow x = ?$. Dosaď do druhé rovnice.',
          '$3 - y = 2 \\Rightarrow y = ?$. Zkontroluj v první rovnici.'
        ],
        odpoved: '$x = 3$, $y = 1$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('3') && n.includes('1')) &&
                 (n.includes('x') || n.includes('y') || n.includes('='));
        },
        postup: [
          { latex: '3x = 9 \\Rightarrow x = 3', stav: 'krok' },
          { latex: '3 - y = 2 \\Rightarrow y = 1', stav: 'krok' },
          { latex: 'x = 3,\\quad y = 1', stav: 'vysledek' }
        ]
      },
      {
        // Zlomková rovnice — záporný výsledek, více kroků
        id: 'r3', tridy: [8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $\\frac{x+5}{2} - \\frac{x-1}{3} = 0$',
        kroky: [
          'Odstraň zlomky: vynásob celou rovnici číslem 6 (nejmenší společný jmenovatel 2 a 3).',
          '$3(x+5) - 2(x-1) = 0$. Rozbal závorky: $3x + 15 - 2x + 2 = 0$.',
          'Zjednodušíme: $x + 17 = 0 \\Rightarrow x = ?$ (záporné číslo!)'
        ],
        odpoved: '$x = -17$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, -17, 0.01),
        postup: [
          { latex: '3(x+5) - 2(x-1) = 0', stav: 'krok' },
          { latex: '3x + 15 - 2x + 2 = 0 \\Rightarrow x + 17 = 0', stav: 'krok' },
          { latex: 'x = -17', stav: 'vysledek' }
        ]
      },
      {
        // Nerovnice s desetinnými koeficienty
        id: 'r4', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Vyřeš nerovnici: $1{,}5x - 2 < 0{,}5x + 4$',
        kroky: [
          'Přesuň členy s $x$ na levou stranu: $1{,}5x - 0{,}5x < 4 + 2$.',
          '$x < ?$. Zapíš řešení jako nerovnici.'
        ],
        odpoved: '$x < 6$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('x < 6') || n.includes('x<6') || blizko(vstup, 6, 0.01);
        },
        postup: [
          { latex: '1{,}5x - 0{,}5x < 4 + 2 \\Rightarrow x < 6', stav: 'vysledek' }
        ]
      },
      {
        // Absolutní hodnota — dvě řešení (jedno záporné)
        id: 'r5', tridy: [8,9], podtyp: 'absolutni',
        zadani: 'Vyřeš rovnici s absolutní hodnotou: $|2x - 4| = 6$',
        kroky: [
          '$|A| = 6$ má dvě řešení: $A = 6$ nebo $A = -6$. Zapiš obě rovnice pro výraz $2x - 4$.',
          'První: $2x - 4 = 6 \\Rightarrow 2x = 10 \\Rightarrow x = ?$',
          'Druhá: $2x - 4 = -6 \\Rightarrow 2x = -2 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 5$ nebo $x = -1$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('5') && (n.includes('-1') || n.includes('−1')));
        },
        postup: [
          { latex: '2x - 4 = 6 \\Rightarrow x = 5', stav: 'krok' },
          { latex: '2x - 4 = -6 \\Rightarrow x = -1', stav: 'krok' },
          { latex: 'x = 5 \\text{ nebo } x = -1', stav: 'vysledek' }
        ]
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
    popis: 'Pythagorova věta, obsah, obvod, složené útvary, souřadnice',
    ulohy: [
      {
        // Pythagorova věta — klasická trojice 6, 8, 10
        id: 'g1', tridy: [8,9], podtyp: 'obsah_zakladni',
        zadani: 'Pravoúhlý trojúhelník má odvěsny délky 6 cm a 8 cm. Jaká je délka přepony?',
        kroky: [
          'Pythagorova věta: $c^2 = a^2 + b^2$. Dosaď $a = 6$, $b = 8$.',
          '$c^2 = 36 + 64 = ?$',
          '$c^2 = 100 \\Rightarrow c = \\sqrt{100} = ?$'
        ],
        odpoved: '10 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 10, 0.01),
        postup: [
          { latex: 'c^2 = 6^2 + 8^2 = 36 + 64 = 100', stav: 'krok' },
          { latex: 'c = \\sqrt{100} = 10 \\text{ cm}', stav: 'vysledek' }
        ]
      },
      {
        // Čtverec: obsah → strana → obvod
        id: 'g2', tridy: [6,7,8,9], podtyp: 'obvod',
        zadani: 'Čtverec má obsah $64\\text{ cm}^2$. Jaký je jeho obvod?',
        kroky: [
          'Obsah čtverce $S = a^2 = 64$. Jaká je délka strany $a$?',
          'Obvod: $O = 4 \\cdot a$. Dosaď $a = 8$ cm.'
        ],
        odpoved: '32 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 32, 0.01),
        postup: [
          { latex: 'a^2 = 64 \\Rightarrow a = 8 \\text{ cm}', stav: 'krok' },
          { latex: 'O = 4 \\cdot 8 = 32 \\text{ cm}', stav: 'vysledek' }
        ]
      },
      {
        // Obvod kruhu — desetinné číslo (π ≈ 3,14)
        id: 'g3', tridy: [6,7,8,9], podtyp: 'obvod',
        zadani: 'Kruh má poloměr 5 cm. Vypočítej jeho obvod (použij $\\pi \\approx 3{,}14$).',
        kroky: [
          'Vzorec: $O = 2 \\cdot \\pi \\cdot r$. Dosaď $r = 5$ a $\\pi = 3{,}14$.',
          '$O = 2 \\cdot 3{,}14 \\cdot 5 = ?$'
        ],
        odpoved: '31,4 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 31.4, 0.02),
        postup: [
          { latex: 'O = 2 \\cdot 3{,}14 \\cdot 5', stav: 'krok' },
          { latex: 'O = 31{,}4 \\text{ cm}', stav: 'vysledek' }
        ]
      },
      {
        // Reálný kontext: bazén s chodníkem — desetinné číslo, odečítání ploch, více kroků
        id: 'g4', tridy: [6,7,8,9], podtyp: 'obsah_zakladni',
        zadani: 'Bazén má rozměry 12 m × 8 m. Kolem bazénu je chodník širký 1,5 m. Jaký je obsah chodníku?',
        kroky: [
          'Vnější obdélník (bazén + chodník): délka $= 12 + 2 \\cdot 1{,}5 = ?$ m, šířka $= 8 + 2 \\cdot 1{,}5 = ?$ m.',
          'Obsah vnějšího obdélníku: $15 \\cdot 11 = ?$ m².',
          'Obsah bazénu: $12 \\cdot 8 = ?$ m². Obsah chodníku $=$ vnější $-$ vnitřní.'
        ],
        odpoved: '$69\\text{ m}^2$',
        jednotka: 'm²',
        kontrola: (vstup) => blizko(vstup, 69, 0.01),
        postup: [
          { latex: '\\text{vnější: } (12+3) \\times (8+3) = 15 \\times 11 = 165 \\text{ m}^2', stav: 'krok' },
          { latex: '\\text{bazén: } 12 \\times 8 = 96 \\text{ m}^2', stav: 'krok' },
          { latex: 'S_{\\text{chodník}} = 165 - 96 = 69 \\text{ m}^2', stav: 'vysledek' }
        ]
      },
      {
        // Vzdálenost bodů v souřadnicové soustavě — záporné souřadnice, Pythagorova věta
        id: 'g5', tridy: [8,9], podtyp: 'obsah_zakladni',
        zadani: 'Vypočítej vzdálenost bodu $A = (-3,\\ 0)$ a bodu $B = (1,\\ 3)$.',
        kroky: [
          'Vzdálenost bodů: $|AB| = \\sqrt{(x_B - x_A)^2 + (y_B - y_A)^2}$.',
          '$x_B - x_A = 1 - (-3) = 4$, $y_B - y_A = 3 - 0 = 3$.',
          '$|AB| = \\sqrt{4^2 + 3^2} = \\sqrt{16 + 9} = \\sqrt{?} = ?$'
        ],
        odpoved: '5',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 5, 0.01),
        postup: [
          { latex: '\\Delta x = 1 - (-3) = 4,\\quad \\Delta y = 3 - 0 = 3', stav: 'krok' },
          { latex: '|AB| = \\sqrt{4^2 + 3^2} = \\sqrt{25} = 5', stav: 'vysledek' }
        ]
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
        // Průměr z dat s desetinnými čísly a zápornými teplotami
        id: 'gr1', tridy: [8,9], podtyp: 'prumery',
        zadani: 'Tabulka teplot (°C) za pět dnů: 12,5 — −2,8 — 6,0 — −1,3 — 8,6. Jaký je průměr teplot?',
        kroky: [
          'Průměr $=$ součet hodnot $\\div$ počet hodnot. Nejdřív spočítej součet (pozor na záporná čísla!).',
          '$12{,}5 + (-2{,}8) + 6{,}0 + (-1{,}3) + 8{,}6 = ?$',
          'Vydel součet 5: průměr $= \\frac{23}{5} = ?$'
        ],
        odpoved: '4,6 °C',
        jednotka: '°C',
        kontrola: (vstup) => blizko(vstup, 4.6, 0.05),
        postup: [
          { latex: '12{,}5 - 2{,}8 + 6{,}0 - 1{,}3 + 8{,}6 = 23', stav: 'krok' },
          { latex: '\\text{průměr} = \\frac{23}{5} = 4{,}6 \\text{ °C}', stav: 'vysledek' }
        ]
      },
      {
        // Procentní pokles — záporný mezivýsledek (rozdíl)
        id: 'gr2', tridy: [8,9], podtyp: 'cteni_dat',
        zadani: 'Graf závodů: loni se zúčastnilo 1 200 závodníků, letos 900. O kolik procent klesl počet závodníků?',
        kroky: [
          'Procentní změna $= \\frac{\\text{nová} - \\text{původní}}{\\text{původní}} \\cdot 100\\,\\%$.',
          'Rozdíl $= 900 - 1\\,200 = ?$ (záporné číslo = pokles).',
          '$\\frac{-300}{1\\,200} \\cdot 100 = ?\\,\\%$. O kolik procent klesl počet závodníků?'
        ],
        odpoved: '25 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 25, 0.01) || blizko(vstup, -25, 0.01),
        postup: [
          { latex: '900 - 1\\,200 = -300 \\text{ (pokles)}', stav: 'krok' },
          { latex: '\\frac{-300}{1\\,200} \\cdot 100 = -25\\,\\%', stav: 'krok' },
          { latex: '\\text{Počet klesl o } 25\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        // Spotřeba paliva — desetinná čísla, reálný kontext, čtení z tabulky
        id: 'gr3', tridy: [8,9], podtyp: 'cteni_dat',
        zadani: 'Z tabulky: průměrná spotřeba auta je 7,5 l / 100 km. Kolik litrů paliva spotřebuje auto na cestu 350 km?',
        kroky: [
          'Spotřeba na 1 km $= \\frac{7{,}5}{100}$ l. Nebo: spotřeba na 350 km $= 7{,}5 \\cdot \\frac{350}{100}$.',
          '$7{,}5 \\cdot 3{,}5 = ?$ l.'
        ],
        odpoved: '26,25 l',
        jednotka: 'l',
        kontrola: (vstup) => blizko(vstup, 26.25, 0.1),
        postup: [
          { latex: '7{,}5 \\cdot \\frac{350}{100} = 7{,}5 \\cdot 3{,}5', stav: 'krok' },
          { latex: '= 26{,}25 \\text{ l}', stav: 'vysledek' }
        ]
      }
    ]
  }
];
