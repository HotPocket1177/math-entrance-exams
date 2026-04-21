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
      },
      {
        // Rychlost a čas — celá čísla, převod hodin na minuty
        id: 's6', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Vlak jede vzdálenost 210 km průměrnou rychlostí 105 km/h. Za kolik minut dorazí do cíle?',
        kroky: [
          'Čas $= \\frac{\\text{vzdálenost}}{\\text{rychlost}}$. Dosaď hodnoty a vypočítej čas v hodinách.',
          '$t = \\frac{210}{105} = ?$ hodiny.',
          'Převeď hodiny na minuty: $? \\cdot 60 = ?$ minut.'
        ],
        odpoved: '120 minut',
        jednotka: 'min',
        kontrola: (vstup) => blizko(vstup, 120, 0.01) || blizko(vstup, 2, 0.01),
        postup: [
          { latex: 't = \\frac{210}{105} = 2 \\text{ hodiny}', stav: 'krok' },
          { latex: '2 \\cdot 60 = 120 \\text{ minut}', stav: 'vysledek' }
        ]
      },
      {
        // Dva sourozenci — dvě neznámé, součet + rozdíl
        id: 's7', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Dva sourozenci mají dohromady 240 Kč. Starší má o 60 Kč více než mladší. Kolik má každý?',
        kroky: [
          'Označ: mladší $= x$ Kč, starší $= x + 60$ Kč. Sestav rovnici ze součtu.',
          '$x + (x + 60) = 240 \\Rightarrow 2x + 60 = 240$. Přesuň 60 doprava.',
          '$2x = 180 \\Rightarrow x = ?$. Kolik má starší?'
        ],
        odpoved: 'Mladší 90 Kč, starší 150 Kč.',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('90') && n.includes('150')) || blizko(vstup, 90) || blizko(vstup, 150);
        },
        postup: [
          { latex: 'x + (x + 60) = 240 \\Rightarrow 2x = 180', stav: 'krok' },
          { latex: '\\text{Mladší: } 90 \\text{ Kč},\\quad \\text{starší: } 150 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        // Průměr — najdi chybějící číslo ze znalosti průměru
        id: 's8', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Sedm čísel má průměr 8. Šest z nich jsou: 5, 9, 11, 6, 8, 7. Jaké je sedmé číslo?',
        kroky: [
          'Průměr $= \\frac{\\text{součet}}{\\text{počet}}$. Kolik musí být celkový součet?',
          '$7 \\cdot 8 = 56$. Sečti šest známých čísel: $5 + 9 + 11 + 6 + 8 + 7 = ?$.',
          'Sedmé číslo $= 56 - ?$'
        ],
        odpoved: '10',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 10, 0.01),
        postup: [
          { latex: '\\text{součet} = 7 \\cdot 8 = 56', stav: 'krok' },
          { latex: '5+9+11+6+8+7 = 46', stav: 'krok' },
          { latex: '56 - 46 = 10', stav: 'vysledek' }
        ]
      },
      {
        // Brigáda — hodinová mzda, celkový výdělek
        id: 's9', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Marie pracuje na brigádě 4 hodiny denně a dostává 125 Kč za hodinu. Za kolik pracovních dní vydělá 3 000 Kč?',
        kroky: [
          'Výdělek za jeden den: $4 \\cdot 125 = ?$ Kč.',
          'Počet dní: $\\frac{3\\,000}{?} = ?$ dní.'
        ],
        odpoved: '6 dní',
        jednotka: 'dní',
        kontrola: (vstup) => blizko(vstup, 6, 0.01),
        postup: [
          { latex: '4 \\cdot 125 = 500 \\text{ Kč/den}', stav: 'krok' },
          { latex: '\\frac{3\\,000}{500} = 6 \\text{ dní}', stav: 'vysledek' }
        ]
      },
      {
        // Nákup — soustavy cen, dvě neznámé ze dvou nákupů
        id: 's10', tridy: [8,9], podtyp: 'soustava',
        zadani: 'Za 3 sešity a 2 propisky zaplatíme 54 Kč. Za 1 sešit a 4 propisky zaplatíme 42 Kč. Kolik stojí sešit a kolik propiska?',
        kroky: [
          'Označ: sešit $= s$, propiska $= p$. Zapiš dvě rovnice.',
          '$3s + 2p = 54$ a $s + 4p = 42$. Z druhé: $s = 42 - 4p$. Dosaď do první.',
          '$3(42 - 4p) + 2p = 54 \\Rightarrow 126 - 12p + 2p = 54 \\Rightarrow -10p = -72 \\Rightarrow p = ?$',
          'Propiska $= 7{,}2$ Kč. Sešit $= 42 - 4 \\cdot 7{,}2 = ?$'
        ],
        odpoved: 'Sešit 13,2 Kč, propiska 7,2 Kč.',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (blizko(vstup, 13.2) || n.includes('13.2') || n.includes('13,2')) ||
                 (blizko(vstup, 7.2)  || n.includes('7.2')  || n.includes('7,2'));
        },
        postup: [
          { latex: 's = 42 - 4p,\\quad 3(42-4p) + 2p = 54', stav: 'krok' },
          { latex: '-10p = -72 \\Rightarrow p = 7{,}2 \\text{ Kč}', stav: 'krok' },
          { latex: 's = 42 - 28{,}8 = 13{,}2 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 's11', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Otci je 38 let, synovi 14 let. Za kolik let bude otec dvakrát starší než syn?',
        kroky: [
          'Za $x$ let bude otci $38 + x$ let a synovi $14 + x$ let. Zapiš podmínku „dvakrát starší".',
          '$38 + x = 2(14 + x) \\Rightarrow 38 + x = 28 + 2x$.',
          '$38 - 28 = 2x - x \\Rightarrow x = ?$'
        ],
        odpoved: 'Za 10 let',
        jednotka: 'let',
        kontrola: (vstup) => blizko(vstup, 10, 0.01),
        postup: [
          { latex: '38 + x = 2(14 + x)', stav: 'krok' },
          { latex: '38 + x = 28 + 2x \\Rightarrow x = 10', stav: 'vysledek' }
        ]
      },
      {
        id: 's12', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Dva vlaky vyjely naproti sobě ze dvou měst vzdálených 360 km. Jeden jede rychlostí 80 km/h, druhý 100 km/h. Za jak dlouho se setkají?',
        kroky: [
          'Setkají se, až součet ujetých vzdáleností bude 360 km. Za čas $t$ ujede první $80t$ km, druhý $100t$ km.',
          '$80t + 100t = 360 \\Rightarrow 180t = 360$.',
          '$t = ?$ hodiny.'
        ],
        odpoved: '2 hodiny',
        jednotka: 'h',
        kontrola: (vstup) => blizko(vstup, 2, 0.01) || blizko(vstup, 120, 0.01),
        postup: [
          { latex: '(80 + 100) \\cdot t = 360 \\Rightarrow 180t = 360', stav: 'krok' },
          { latex: 't = 2 \\text{ hodiny}', stav: 'vysledek' }
        ]
      },
      {
        id: 's13', tridy: [7,8,9], podtyp: 'soustava',
        zadani: 'Na výstavu přišlo 80 osob. Dospělí platili 120 Kč, děti 60 Kč. Celkem vybrali 7 800 Kč. Kolik bylo dospělých a kolik dětí?',
        kroky: [
          'Označ: dospělých $= d$, dětí $= k$. Soustava: $d + k = 80$ a $120d + 60k = 7\\,800$.',
          'Z první rovnice: $k = 80 - d$. Dosaď do druhé.',
          '$120d + 60(80 - d) = 7\\,800 \\Rightarrow 60d = 3\\,000 \\Rightarrow d = ?$'
        ],
        odpoved: '50 dospělých, 30 dětí',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('50') && n.includes('30')) || blizko(vstup, 50);
        },
        postup: [
          { latex: '120d + 60(80-d) = 7\\,800 \\Rightarrow 60d = 3\\,000', stav: 'krok' },
          { latex: 'd = 50 \\text{ dospělých},\\quad k = 30 \\text{ dětí}', stav: 'vysledek' }
        ]
      },
      {
        id: 's14', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Jeden dělník zvládne práci za 12 hodin, druhý za 18 hodin. Za kolik hodin ji zvládnou společně?',
        kroky: [
          'Výkon za hodinu: první $= \\frac{1}{12}$ práce, druhý $= \\frac{1}{18}$ práce. Jejich společný výkon?',
          '$\\frac{1}{12} + \\frac{1}{18} = \\frac{3}{36} + \\frac{2}{36} = \\frac{5}{36}$ práce za hodinu.',
          'Celková práce $= 1$. Čas $= 1 \\div \\frac{5}{36} = ?$'
        ],
        odpoved: '7,2 hodiny',
        jednotka: 'h',
        kontrola: (vstup) => blizko(vstup, 7.2, 0.05),
        postup: [
          { latex: '\\tfrac{1}{12} + \\tfrac{1}{18} = \\tfrac{5}{36} \\text{ práce/hod}', stav: 'krok' },
          { latex: 't = \\frac{36}{5} = 7{,}2 \\text{ hodiny}', stav: 'vysledek' }
        ]
      },
      {
        id: 's15', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Eva má o 250 Kč méně než David. Dohromady mají 1 450 Kč. Kolik má každý z nich?',
        kroky: [
          'Označ Davidovu částku jako $d$. Eva má $d - 250$ Kč. Zapiš rovnici pro součet.',
          '$d + (d - 250) = 1\\,450 \\Rightarrow 2d - 250 = 1\\,450$.',
          '$2d = 1\\,700 \\Rightarrow d = ?$. Kolik má Eva?'
        ],
        odpoved: 'David 850 Kč, Eva 600 Kč.',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('850') && n.includes('600')) || blizko(vstup, 850) || blizko(vstup, 600);
        },
        postup: [
          { latex: '2d - 250 = 1\\,450 \\Rightarrow 2d = 1\\,700', stav: 'krok' },
          { latex: 'David: 850 \\text{ Kč},\\quad Eva: 600 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 's16', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Dva cyklisté jedou naproti sobě ze dvou měst vzdálených 120 km. Jeden jede rychlostí 25 km/h, druhý 15 km/h. Za jak dlouho se setkají?',
        kroky: [
          'Obě rychlosti se sčítají: $v_{\\text{celk}} = 25 + 15 = 40$ km/h.',
          '$t = \\frac{120}{40} = ?$ hodiny.'
        ],
        odpoved: '3 hodiny',
        jednotka: 'h',
        kontrola: (vstup) => blizko(vstup, 3, 0.01) || blizko(vstup, 180, 0.01),
        postup: [
          { latex: 'v_{\\text{celk}} = 25 + 15 = 40 \\text{ km/h}', stav: 'krok' },
          { latex: 't = \\frac{120}{40} = 3 \\text{ hodiny}', stav: 'vysledek' }
        ]
      },
      {
        id: 's17', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Tři přátelé si rozdělí 840 Kč v poměru 2 : 3 : 5. Kolik dostane každý z nich?',
        kroky: [
          'Celkový počet dílů: $2 + 3 + 5 = 10$ dílů. Jeden díl $= 840 \\div 10 = ?$ Kč.',
          'První dostane $2 \\cdot 84 = ?$ Kč, druhý $3 \\cdot 84 = ?$ Kč, třetí $5 \\cdot 84 = ?$ Kč.'
        ],
        odpoved: '168 Kč, 252 Kč a 420 Kč',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('168') && n.includes('420')) || blizko(vstup, 168) || blizko(vstup, 420);
        },
        postup: [
          { latex: '\\text{1 díl} = \\frac{840}{10} = 84 \\text{ Kč}', stav: 'krok' },
          { latex: '168 \\text{ Kč} : 252 \\text{ Kč} : 420 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 's18', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Délka obdélníku je třikrát větší než šířka. Obvod obdélníku je 96 cm. Jaký je obsah obdélníku?',
        kroky: [
          'Označ šířku $= w$, délku $= 3w$. Obvod: $2(w + 3w) = 96$.',
          '$2 \\cdot 4w = 96 \\Rightarrow 8w = 96 \\Rightarrow w = ?$',
          'Šířka $= 12$ cm, délka $= 36$ cm. Obsah $= ?$'
        ],
        odpoved: '432 cm²',
        jednotka: 'cm²',
        kontrola: (vstup) => blizko(vstup, 432, 0.01),
        postup: [
          { latex: '8w = 96 \\Rightarrow w = 12 \\text{ cm},\\quad l = 36 \\text{ cm}', stav: 'krok' },
          { latex: 'S = 12 \\cdot 36 = 432 \\text{ cm}^2', stav: 'vysledek' }
        ]
      },
      {
        id: 's19', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Auto jelo 120 km průměrnou rychlostí 60 km/h a pak 80 km rychlostí 40 km/h. Jaká je průměrná rychlost celé cesty?',
        kroky: [
          'Čas první části: $t_1 = 120 \\div 60 = 2$ h. Čas druhé části: $t_2 = 80 \\div 40 = 2$ h.',
          'Celková vzdálenost: $120 + 80 = 200$ km. Celkový čas: $2 + 2 = 4$ h.',
          'Průměrná rychlost $= 200 \\div 4 = ?$ km/h.'
        ],
        odpoved: '50 km/h',
        jednotka: 'km/h',
        kontrola: (vstup) => blizko(vstup, 50, 0.01),
        postup: [
          { latex: 't_1 = 2\\text{ h},\\quad t_2 = 2\\text{ h}', stav: 'krok' },
          { latex: 'v_{\\text{prům}} = \\frac{200}{4} = 50 \\text{ km/h}', stav: 'vysledek' }
        ]
      },
      {
        id: 's20', tridy: [7,8,9], podtyp: 'soustava',
        zadani: 'Za 3 kg jablek a 2 kg hrušek zaplatíme 82 Kč. Za 2 kg jablek a 3 kg hrušek zaplatíme 78 Kč. Kolik stojí 1 kg jablek?',
        kroky: [
          'Označ: jablka $= a$, hrušky $= h$. Soustava: $3a + 2h = 82$ a $2a + 3h = 78$.',
          'Vynásob první rovnici 3 a druhou 2: $9a + 6h = 246$, $4a + 6h = 156$.',
          'Odečti druhou od první: $5a = 90 \\Rightarrow a = ?$'
        ],
        odpoved: 'Jablka 18 Kč/kg, hrušky 14 Kč/kg.',
        jednotka: 'Kč/kg',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('18') && n.includes('14')) || blizko(vstup, 18);
        },
        postup: [
          { latex: '9a + 6h = 246,\\quad 4a + 6h = 156', stav: 'krok' },
          { latex: '5a = 90 \\Rightarrow a = 18 \\text{ Kč/kg}', stav: 'krok' },
          { latex: 'h = (82 - 54) / 2 = 14 \\text{ Kč/kg}', stav: 'vysledek' }
        ]
      },
      {
        id: 's21', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Škola organizuje výlet pro 150 žáků. Každý autobus pojme 48 žáků. Kolik autobusů je minimálně potřeba?',
        kroky: [
          '$150 \\div 48 = ?$. Výsledek není celé číslo — co to znamená pro počet autobusů?',
          '$150 \\div 48 \\approx 3{,}125$. Protože nesmíme nikoho nechat doma, zaokrouhlujeme nahoru.'
        ],
        odpoved: '4 autobusy',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 4, 0.01),
        postup: [
          { latex: '150 \\div 48 = 3{,}125', stav: 'krok' },
          { latex: '\\text{Zaokrouhlit nahoru} \\Rightarrow 4 \\text{ autobusy}', stav: 'vysledek' }
        ]
      },
      {
        id: 's22', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Obchodník chce smíchat kávu za 200 Kč/kg s kávou za 350 Kč/kg tak, aby 1 kg směsi stál 260 Kč. Kolik gramů levné kávy potřebuje?',
        kroky: [
          'Označ množství levné kávy jako $x$ kg. Drahé kávy bude $1 - x$ kg.',
          '$200x + 350(1 - x) = 260$. Rozbal závorku.',
          '$200x + 350 - 350x = 260 \\Rightarrow -150x = -90 \\Rightarrow x = ?$'
        ],
        odpoved: '600 g',
        jednotka: 'g',
        kontrola: (vstup) => blizko(vstup, 600, 5) || blizko(vstup, 0.6, 0.01),
        postup: [
          { latex: '200x + 350(1-x) = 260', stav: 'krok' },
          { latex: '-150x = -90 \\Rightarrow x = 0{,}6 \\text{ kg} = 600 \\text{ g}', stav: 'vysledek' }
        ]
      },
      {
        id: 's23', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Turistická trasa je 135 km. Skupina chodí 9 hodin denně průměrnou rychlostí 5 km/h. Za kolik dní trasu projdou?',
        kroky: [
          'Za jeden den ujdou: $9 \\cdot 5 = ?$ km.',
          'Počet dní $= 135 \\div ?$'
        ],
        odpoved: '3 dny',
        jednotka: 'dní',
        kontrola: (vstup) => blizko(vstup, 3, 0.01),
        postup: [
          { latex: '\\text{za den: } 9 \\cdot 5 = 45 \\text{ km}', stav: 'krok' },
          { latex: '135 \\div 45 = 3 \\text{ dny}', stav: 'vysledek' }
        ]
      },
      {
        id: 's24', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Tomáš spoří každý týden 250 Kč. Za kolik týdnů ušetří 4 000 Kč?',
        kroky: [
          'Počet týdnů $= 4\\,000 \\div 250 = ?$'
        ],
        odpoved: '16 týdnů',
        jednotka: 'týdnů',
        kontrola: (vstup) => blizko(vstup, 16, 0.01),
        postup: [
          { latex: '4\\,000 \\div 250 = 16 \\text{ týdnů}', stav: 'vysledek' }
        ]
      },
      {
        id: 's25', tridy: [7,8,9], podtyp: 'soustava',
        zadani: 'Do kina přišlo 120 diváků. Lístek stojí 150 Kč nebo 90 Kč (pro studenty). Celkem vybrali 15 600 Kč. Kolik bylo studentů?',
        kroky: [
          'Označ: dospělých $= d$, studentů $= s$. Soustava: $d + s = 120$ a $150d + 90s = 15\\,600$.',
          'Z první: $d = 120 - s$. Dosaď do druhé.',
          '$150(120 - s) + 90s = 15\\,600 \\Rightarrow 18\\,000 - 60s = 15\\,600 \\Rightarrow s = ?$'
        ],
        odpoved: '40 studentů, 80 dospělých',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('40') && n.includes('80')) || blizko(vstup, 40);
        },
        postup: [
          { latex: '18\\,000 - 60s = 15\\,600 \\Rightarrow 60s = 2\\,400', stav: 'krok' },
          { latex: 's = 40 \\text{ studentů},\\quad d = 80 \\text{ dospělých}', stav: 'vysledek' }
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
      },
      {
        // DPH — zpětný výpočet ceny bez daně
        id: 'p6', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Cena zboží včetně DPH 21 % je 1 210 Kč. Jaká je cena bez DPH?',
        kroky: [
          'Cena s DPH $= $ cena bez DPH $\\times 1{,}21$. Označ cenu bez DPH jako $x$.',
          '$1{,}21 \\cdot x = 1\\,210$. Jak vyjádříš $x$?',
          '$x = \\frac{1\\,210}{1{,}21} = ?$'
        ],
        odpoved: '1 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 1000, 0.01),
        postup: [
          { latex: 'x = \\text{cena bez DPH}', stav: 'krok' },
          { latex: '1{,}21 \\cdot x = 1\\,210', stav: 'krok' },
          { latex: 'x = \\frac{1\\,210}{1{,}21} = 1\\,000 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        // Počet z procent — celá čísla, reálný kontext
        id: 'p7', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Třída má 30 žáků, z toho 40 % jsou chlapci. Kolik je v třídě dívek?',
        kroky: [
          'Počet chlapců: $40\\,\\% \\cdot 30 = 0{,}4 \\cdot 30 = ?$.',
          'Dívky $=$ celkem $-$ chlapci. Kolik?'
        ],
        odpoved: '18 dívek',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 18, 0.01),
        postup: [
          { latex: '0{,}4 \\cdot 30 = 12 \\text{ chlapců}', stav: 'krok' },
          { latex: '30 - 12 = 18 \\text{ dívek}', stav: 'vysledek' }
        ]
      },
      {
        // Složené procento — zdražení pak zlevnění, výsledek překvapivý
        id: 'p8', tridy: [8,9], podtyp: 'zakladni',
        zadani: 'Cena zboží nejprve vzrostla o 25 % a poté klesla o 20 %. Jaká je celková procentní změna oproti původní ceně?',
        kroky: [
          'Začni s cenou 100 Kč. Po zdražení o 25 %: $100 \\cdot 1{,}25 = ?$ Kč.',
          'Z nové ceny (125 Kč) slevní o 20 %: $125 \\cdot 0{,}8 = ?$ Kč.',
          'Celková změna $= $ výsledná cena $- 100$. Kolik procent je to z původní ceny?'
        ],
        odpoved: '0 % (cena se vrátila na původní hodnotu)',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 0, 0.1) || normalizuj(vstup).includes('0'),
        postup: [
          { latex: '100 \\cdot 1{,}25 = 125 \\text{ Kč}', stav: 'krok' },
          { latex: '125 \\cdot 0{,}8 = 100 \\text{ Kč}', stav: 'krok' },
          { latex: '\\text{Celková změna: } 0\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        // Zpětný výpočet z části — úspory na dovolené
        id: 'p9', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Karel utratil 30 % svých úspor na dovolenou a zaplatil 4 500 Kč. Kolik měl Karel celkem úspor?',
        kroky: [
          'Označ celkové úspory jako $x$. $30\\,\\% \\cdot x = 4\\,500$.',
          '$0{,}3 \\cdot x = 4\\,500 \\Rightarrow x = ?$'
        ],
        odpoved: '15 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 15000, 0.01),
        postup: [
          { latex: '0{,}3 \\cdot x = 4\\,500', stav: 'krok' },
          { latex: 'x = \\frac{4\\,500}{0{,}3} = 15\\,000 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        // Vyjádření procent z celku — reálný kontext (test, školní výsledky)
        id: 'p10', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Ze 40 žáků v ročníku prospělo s vyznamenáním 24 žáků. Kolik procent žáků prospělo s vyznamenáním?',
        kroky: [
          'Procento $= \\frac{\\text{část}}{\\text{celek}} \\cdot 100\\,\\%$.',
          '$\\frac{24}{40} \\cdot 100 = ?\\,\\%$'
        ],
        odpoved: '60 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 60, 0.01),
        postup: [
          { latex: '\\frac{24}{40} \\cdot 100', stav: 'krok' },
          { latex: '= 60\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        id: 'p11', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Jana dostala přidáno 12 % k platu. Nyní bere 22 400 Kč. Jaký byl její původní plat?',
        kroky: [
          'Nový plat $= $ původní $\\cdot 1{,}12$. Označ původní plat jako $x$.',
          '$1{,}12 \\cdot x = 22\\,400 \\Rightarrow x = \\frac{22\\,400}{1{,}12} = ?$'
        ],
        odpoved: '20 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 20000, 0.01),
        postup: [
          { latex: '1{,}12 \\cdot x = 22\\,400', stav: 'krok' },
          { latex: 'x = 20\\,000 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p12', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Televize je v akci se slevou 30 %. Zlevněná cena je 7 000 Kč. Jaká byla původní cena?',
        kroky: [
          'Po 30% slevě platíme $70\\,\\%$ z původní ceny. Označ původní cenu jako $x$.',
          '$0{,}7 \\cdot x = 7\\,000 \\Rightarrow x = ?$'
        ],
        odpoved: '10 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 10000, 0.01),
        postup: [
          { latex: '0{,}7 \\cdot x = 7\\,000', stav: 'krok' },
          { latex: 'x = 10\\,000 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p13', tridy: [8,9], podtyp: 'zakladni',
        zadani: 'Cena plynu vzrostla o 15 % a pak o dalších 8 %. O kolik procent celkem vzrostla cena oproti původní?',
        kroky: [
          'Začni s cenou 100 Kč. Po prvním zdražení: $100 \\cdot 1{,}15 = 115$ Kč.',
          'Po druhém zdražení: $115 \\cdot 1{,}08 = ?$ Kč.',
          'Celkový nárůst $= ? - 100$. Vyjádři v procentech z původní ceny 100 Kč.'
        ],
        odpoved: '24,2 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 24.2, 0.1),
        postup: [
          { latex: '100 \\cdot 1{,}15 \\cdot 1{,}08 = 124{,}2 \\text{ Kč}', stav: 'krok' },
          { latex: '\\text{celkový nárůst: } 24{,}2\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        id: 'p14', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Z 800 oslovených lidí odpovědělo kladně 560. Kolik procent odpovědělo kladně?',
        kroky: [
          'Procento $= \\frac{\\text{část}}{\\text{celek}} \\cdot 100\\,\\%$.',
          '$\\frac{560}{800} \\cdot 100 = ?\\,\\%$'
        ],
        odpoved: '70 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 70, 0.01),
        postup: [
          { latex: '\\frac{560}{800} \\cdot 100 = 70\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        id: 'p15', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Základní cena zboží je 2 400 Kč. DPH je 15 %. Jaká je cena s DPH?',
        kroky: [
          'Cena s DPH $= $ základní cena $\\cdot (1 + 0{,}15) = $ základní cena $\\cdot 1{,}15$.',
          '$2\\,400 \\cdot 1{,}15 = ?$ Kč.'
        ],
        odpoved: '2 760 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 2760, 0.01),
        postup: [
          { latex: '2\\,400 \\cdot 1{,}15 = 2\\,760 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p16', tridy: [8,9], podtyp: 'zakladni',
        zadani: 'Roztok obsahuje 40 g soli v 250 g roztoku. Kolik procent tvoří sůl v roztoku?',
        kroky: [
          'Hmotnostní procento $= \\frac{\\text{hmotnost látky}}{\\text{hmotnost roztoku}} \\cdot 100\\,\\%$.',
          '$\\frac{40}{250} \\cdot 100 = ?\\,\\%$'
        ],
        odpoved: '16 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 16, 0.01),
        postup: [
          { latex: '\\frac{40}{250} \\cdot 100 = 16\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        id: 'p17', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Obchodník koupil zboží za 600 Kč a prodal za 750 Kč. Kolik procent tvoří zisk z kupní ceny?',
        kroky: [
          'Zisk $= 750 - 600 = 150$ Kč.',
          'Zisk v procentech $= \\frac{150}{600} \\cdot 100 = ?\\,\\%$'
        ],
        odpoved: '25 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 25, 0.01),
        postup: [
          { latex: '\\text{zisk} = 750 - 600 = 150 \\text{ Kč}', stav: 'krok' },
          { latex: '\\frac{150}{600} \\cdot 100 = 25\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        id: 'p18', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Po zdražení o 25 % stojí výrobek 875 Kč. Jaká byla původní cena?',
        kroky: [
          'Po zdražení o 25 % platíme $125\\,\\%$ z původní ceny. Označ původní cenu jako $x$.',
          '$1{,}25 \\cdot x = 875 \\Rightarrow x = \\frac{875}{1{,}25} = ?$'
        ],
        odpoved: '700 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 700, 0.01),
        postup: [
          { latex: '1{,}25 \\cdot x = 875', stav: 'krok' },
          { latex: 'x = 700 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p19', tridy: [7,8,9], podtyp: 'zpetny',
        zadani: 'Marta utratila 35 % svého kapesného za oblečení a zaplatila 1 750 Kč. Kolik bylo její kapesné?',
        kroky: [
          'Označ kapesné jako $x$. $35\\,\\% \\cdot x = 1\\,750$.',
          '$0{,}35 \\cdot x = 1\\,750 \\Rightarrow x = ?$'
        ],
        odpoved: '5 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 5000, 0.01),
        postup: [
          { latex: '0{,}35 \\cdot x = 1\\,750', stav: 'krok' },
          { latex: 'x = 5\\,000 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p20', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Škola měla loni 350 žáků, letos 385 žáků. O kolik procent vzrostl počet žáků?',
        kroky: [
          'Procentní změna $= \\frac{\\text{nová} - \\text{původní}}{\\text{původní}} \\cdot 100\\,\\%$.',
          '$\\frac{385 - 350}{350} \\cdot 100 = \\frac{35}{350} \\cdot 100 = ?\\,\\%$'
        ],
        odpoved: '10 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 10, 0.01),
        postup: [
          { latex: '\\frac{35}{350} \\cdot 100 = 10\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        id: 'p21', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'V obchodě je sleva 20 % na oblečení. Košile stojí původně 650 Kč. Za kolik ji koupíš?',
        kroky: [
          'Po 20% slevě platíme $80\\,\\%$ z původní ceny.',
          '$650 \\cdot 0{,}8 = ?$ Kč.'
        ],
        odpoved: '520 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 520, 0.01),
        postup: [
          { latex: '650 \\cdot 0{,}8 = 520 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p22', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Obchodní zástupce dostane 5 % provize z prodeje. V červenci prodal za 120 000 Kč. Kolik mu přijde provize?',
        kroky: [
          'Provize $= 5\\,\\% \\cdot 120\\,000 = 0{,}05 \\cdot 120\\,000 = ?$ Kč.'
        ],
        odpoved: '6 000 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 6000, 0.01),
        postup: [
          { latex: '0{,}05 \\cdot 120\\,000 = 6\\,000 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p23', tridy: [8,9], podtyp: 'zpetny',
        zadani: 'Výrobek stojí 968 Kč včetně 21% DPH. Jaká je cena bez DPH?',
        kroky: [
          'Cena s DPH $= $ cena bez DPH $\\cdot 1{,}21$. Označ cenu bez DPH jako $x$.',
          '$1{,}21 \\cdot x = 968 \\Rightarrow x = \\frac{968}{1{,}21} = ?$'
        ],
        odpoved: '800 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 800, 0.01),
        postup: [
          { latex: '1{,}21 \\cdot x = 968', stav: 'krok' },
          { latex: 'x = 800 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        id: 'p24', tridy: [8,9], podtyp: 'zakladni',
        zadani: 'Zboží zdražilo o 40 % a pak se zlevnilo o 40 %. Je výsledná cena vyšší nebo nižší oproti původní? O kolik procent?',
        kroky: [
          'Začni s cenou 100 Kč. Po zdražení: $100 \\cdot 1{,}4 = 140$ Kč.',
          'Po slevě o 40 % z nové ceny: $140 \\cdot 0{,}6 = ?$ Kč.',
          'Porovnej s původní cenou 100 Kč. O kolik procent se liší?'
        ],
        odpoved: 'Nižší o 16 %',
        jednotka: '%',
        kontrola: (vstup) => blizko(vstup, 16, 0.5) || blizko(vstup, -16, 0.5),
        postup: [
          { latex: '100 \\cdot 1{,}4 = 140 \\text{ Kč}', stav: 'krok' },
          { latex: '140 \\cdot 0{,}6 = 84 \\text{ Kč}', stav: 'krok' },
          { latex: '84 - 100 = -16\\,\\% \\Rightarrow \\text{nižší o } 16\\,\\%', stav: 'vysledek' }
        ]
      },
      {
        id: 'p25', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Třídy mají dohromady 360 žáků. Z toho 45 % jsou chlapci. Kolik je chlapců a kolik dívek?',
        kroky: [
          'Chlapci $= 45\\,\\% \\cdot 360 = 0{,}45 \\cdot 360 = ?$.',
          'Dívky $= 360 - ?$'
        ],
        odpoved: '162 chlapců, 198 dívek',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('162') && n.includes('198')) || blizko(vstup, 162) || blizko(vstup, 198);
        },
        postup: [
          { latex: '0{,}45 \\cdot 360 = 162 \\text{ chlapců}', stav: 'krok' },
          { latex: '360 - 162 = 198 \\text{ dívek}', stav: 'vysledek' }
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
      },
      {
        // Sčítání smíšených čísel — základ operací se zlomky
        id: 'z6', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Vypočítej: $2\\dfrac{3}{4} + 1\\dfrac{1}{3}$',
        kroky: [
          'Rozlož na celé části a zlomky: $(2 + 1) + \\left(\\frac{3}{4} + \\frac{1}{3}\\right)$.',
          'NSN(4, 3) = 12. Převeď: $\\frac{3}{4} = \\frac{9}{12}$, $\\frac{1}{3} = \\frac{4}{12}$.',
          '$\\frac{9}{12} + \\frac{4}{12} = \\frac{13}{12} = 1\\frac{1}{12}$. Přičti celé části: $3 + 1\\frac{1}{12} = ?$'
        ],
        odpoved: '$4\\dfrac{1}{12}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('4') && (n.includes('1/12') || n.includes('1 / 12')) || blizko(vstup, 4 + 1/12);
        },
        postup: [
          { latex: '\\tfrac{3}{4} + \\tfrac{1}{3} = \\tfrac{9}{12} + \\tfrac{4}{12} = \\tfrac{13}{12}', stav: 'krok' },
          { latex: '3 + \\tfrac{13}{12} = 4\\tfrac{1}{12}', stav: 'vysledek' }
        ]
      },
      {
        // Část z celku — základní výpočet zlomku z čísla
        id: 'z7', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Kolik je $\\dfrac{3}{8}$ z čísla 200?',
        kroky: [
          '$\\frac{3}{8} \\cdot 200 = ?$. Nejdřív spočítej $\\frac{1}{8}$ z 200.',
          '$\\frac{200}{8} = 25$. Výsledek $= 3 \\cdot 25 = ?$'
        ],
        odpoved: '75',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 75, 0.01),
        postup: [
          { latex: '\\tfrac{1}{8} \\cdot 200 = 25', stav: 'krok' },
          { latex: '3 \\cdot 25 = 75', stav: 'vysledek' }
        ]
      },
      {
        // Dělení zlomků — méně obvyklá operace, výsledek > 1
        id: 'z8', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Vypočítej: $\\dfrac{3}{4} \\div \\dfrac{9}{16}$',
        kroky: [
          'Dělení zlomku = násobení převráceným číslem. Jaké je převrácené číslo k $\\frac{9}{16}$?',
          '$\\frac{3}{4} \\cdot \\frac{16}{9} = \\frac{3 \\cdot 16}{4 \\cdot 9} = \\frac{48}{36}$. Zkrať výsledek.',
          '$\\frac{48}{36} = \\frac{4}{3}$. Jde výsledek zapsat jako smíšené číslo?'
        ],
        odpoved: '$\\dfrac{4}{3}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('4/3') || n.includes('4 / 3') || blizko(vstup, 4/3);
        },
        postup: [
          { latex: '\\tfrac{3}{4} \\div \\tfrac{9}{16} = \\tfrac{3}{4} \\cdot \\tfrac{16}{9} = \\tfrac{48}{36}', stav: 'krok' },
          { latex: '\\tfrac{48}{36} = \\tfrac{4}{3}', stav: 'vysledek' }
        ]
      },
      {
        // Reálný kontext: džus — zlomek ze zlomku, desetinný výsledek
        id: 'z9', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'V džbánu bylo $\\dfrac{3}{5}$ litru džusu. Vypilo se $\\dfrac{2}{3}$ z toho množství. Kolik litrů zbývá?',
        kroky: [
          'Vypité množství: $\\frac{2}{3} \\cdot \\frac{3}{5} = ?$ litrů.',
          '$\\frac{2}{3} \\cdot \\frac{3}{5} = \\frac{6}{15} = \\frac{2}{5}$ litrů. Zbývá: $\\frac{3}{5} - \\frac{2}{5} = ?$'
        ],
        odpoved: '$\\dfrac{1}{5}$ l (= 0,2 l)',
        jednotka: 'l',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('1/5') || n.includes('0.2') || n.includes('0,2') || blizko(vstup, 0.2);
        },
        postup: [
          { latex: '\\tfrac{2}{3} \\cdot \\tfrac{3}{5} = \\tfrac{2}{5} \\text{ l}', stav: 'krok' },
          { latex: '\\tfrac{3}{5} - \\tfrac{2}{5} = \\tfrac{1}{5} \\text{ l}', stav: 'vysledek' }
        ]
      },
      {
        // Porovnání zlomků — převod na společného jmenovatele
        id: 'z10', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Který ze zlomků $\\dfrac{3}{4}$, $\\dfrac{5}{6}$, $\\dfrac{2}{3}$ je největší? Seřaď je od nejmenšího po největší.',
        kroky: [
          'Najdi NSN jmenovatelů 4, 6 a 3. NSN = ?',
          'NSN = 12. Převeď: $\\frac{3}{4} = \\frac{?}{12}$, $\\frac{5}{6} = \\frac{?}{12}$, $\\frac{2}{3} = \\frac{?}{12}$.',
          'Srovnej čitatele: $\\frac{9}{12}$, $\\frac{10}{12}$, $\\frac{8}{12}$. Seřaď od nejmenšího.'
        ],
        odpoved: '$\\dfrac{2}{3} < \\dfrac{3}{4} < \\dfrac{5}{6}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('5/6') && (n.includes('2/3') || n.includes('3/4'));
        },
        postup: [
          { latex: '\\tfrac{2}{3}=\\tfrac{8}{12},\\quad \\tfrac{3}{4}=\\tfrac{9}{12},\\quad \\tfrac{5}{6}=\\tfrac{10}{12}', stav: 'krok' },
          { latex: '\\tfrac{2}{3} < \\tfrac{3}{4} < \\tfrac{5}{6}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z11', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Vypočítej: $\\dfrac{5}{8} \\cdot \\dfrac{4}{15}$',
        kroky: [
          'Násob čitatele a jmenovatele: $\\frac{5 \\cdot 4}{8 \\cdot 15} = \\frac{20}{120}$.',
          'Zjednoduš: NSD(20, 120) = 20. $\\frac{20}{120} = ?$'
        ],
        odpoved: '$\\dfrac{1}{6}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('1/6') || n.includes('1 / 6') || blizko(vstup, 1/6);
        },
        postup: [
          { latex: '\\frac{5 \\cdot 4}{8 \\cdot 15} = \\frac{20}{120}', stav: 'krok' },
          { latex: '\\frac{20}{120} = \\frac{1}{6}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z12', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Zapiš jako smíšené číslo: $\\dfrac{29}{7}$',
        kroky: [
          '$29 \\div 7 = ?$ zbytek $?$. Celá část je podíl, zlomková část je zbytek/7.',
          '$29 = 4 \\cdot 7 + 1 \\Rightarrow \\frac{29}{7} = 4\\frac{1}{7}$.'
        ],
        odpoved: '$4\\dfrac{1}{7}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('4') && (n.includes('1/7') || n.includes('1 / 7')) || blizko(vstup, 29/7);
        },
        postup: [
          { latex: '29 = 4 \\cdot 7 + 1', stav: 'krok' },
          { latex: '\\frac{29}{7} = 4\\tfrac{1}{7}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z13', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Jana přečetla $\\dfrac{3}{5}$ knihy. Ze zbývající části přečetla ještě $\\dfrac{1}{4}$. Jaký podíl celé knihy Jana přečetla celkem?',
        kroky: [
          'Zbývá po první části: $1 - \\frac{3}{5} = \\frac{2}{5}$ knihy.',
          'Z toho přečte čtvrtinu: $\\frac{1}{4} \\cdot \\frac{2}{5} = \\frac{2}{20} = \\frac{1}{10}$ knihy.',
          'Celkem přečteno: $\\frac{3}{5} + \\frac{1}{10} = \\frac{6}{10} + \\frac{1}{10} = ?$'
        ],
        odpoved: '$\\dfrac{7}{10}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('7/10') || n.includes('7 / 10') || blizko(vstup, 0.7);
        },
        postup: [
          { latex: '\\tfrac{1}{4} \\cdot \\tfrac{2}{5} = \\tfrac{1}{10}', stav: 'krok' },
          { latex: '\\tfrac{3}{5} + \\tfrac{1}{10} = \\tfrac{7}{10}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z14', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Petr vynaložil $\\dfrac{2}{7}$ peněz na jídlo a $\\dfrac{3}{7}$ na cestovné. Jaký zlomek peněz mu zbývá?',
        kroky: [
          'Vydaná část: $\\frac{2}{7} + \\frac{3}{7} = ?$ (stejný jmenovatel).',
          'Zbývá: $1 - \\frac{5}{7} = ?$'
        ],
        odpoved: '$\\dfrac{2}{7}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('2/7') || n.includes('2 / 7') || blizko(vstup, 2/7);
        },
        postup: [
          { latex: '\\tfrac{2}{7} + \\tfrac{3}{7} = \\tfrac{5}{7}', stav: 'krok' },
          { latex: '1 - \\tfrac{5}{7} = \\tfrac{2}{7}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z15', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Vypočítej: $\\dfrac{1}{2} + \\dfrac{1}{3} + \\dfrac{1}{6}$',
        kroky: [
          'NSN(2, 3, 6) = 6. Převeď: $\\frac{1}{2} = \\frac{?}{6}$, $\\frac{1}{3} = \\frac{?}{6}$.',
          '$\\frac{3}{6} + \\frac{2}{6} + \\frac{1}{6} = ?$'
        ],
        odpoved: '$1$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 1, 0.01),
        postup: [
          { latex: '\\frac{3}{6} + \\frac{2}{6} + \\frac{1}{6} = \\frac{6}{6}', stav: 'krok' },
          { latex: '= 1', stav: 'vysledek' }
        ]
      },
      {
        id: 'z16', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: '$\\dfrac{3}{8}$ z čísla $x$ je 24. Jaké je číslo $x$?',
        kroky: [
          '$\\frac{3}{8} \\cdot x = 24$. Vyřeš pro $x$.',
          '$x = 24 \\cdot \\frac{8}{3} = \\frac{192}{3} = ?$'
        ],
        odpoved: '$x = 64$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 64, 0.01),
        postup: [
          { latex: 'x = 24 \\cdot \\frac{8}{3}', stav: 'krok' },
          { latex: 'x = 64', stav: 'vysledek' }
        ]
      },
      {
        id: 'z17', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Sklad je zaplněn na $\\dfrac{3}{4}$. Přivezli další zboží, které zaplnilo $\\dfrac{2}{5}$ zbývajícího místa. Na kolik celkového skladu je teď obsazeno?',
        kroky: [
          'Zbývající prostor před dovozem: $1 - \\frac{3}{4} = \\frac{1}{4}$.',
          'Nově zaplněno: $\\frac{2}{5} \\cdot \\frac{1}{4} = \\frac{2}{20} = \\frac{1}{10}$.',
          'Celkem obsazeno: $\\frac{3}{4} + \\frac{1}{10} = \\frac{15}{20} + \\frac{2}{20} = ?$'
        ],
        odpoved: '$\\dfrac{17}{20}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('17/20') || n.includes('17 / 20') || blizko(vstup, 17/20);
        },
        postup: [
          { latex: '\\tfrac{2}{5} \\cdot \\tfrac{1}{4} = \\tfrac{1}{10}', stav: 'krok' },
          { latex: '\\tfrac{3}{4} + \\tfrac{1}{10} = \\tfrac{15}{20} + \\tfrac{2}{20} = \\tfrac{17}{20}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z18', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Rodina spotřebuje za den $\\dfrac{5}{6}$ kg rýže. Za kolik dní spotřebuje zásobu 5 kg?',
        kroky: [
          'Počet dní $= 5 \\div \\frac{5}{6} = 5 \\cdot \\frac{6}{5} = ?$'
        ],
        odpoved: '6 dní',
        jednotka: 'dní',
        kontrola: (vstup) => blizko(vstup, 6, 0.01),
        postup: [
          { latex: '5 \\div \\tfrac{5}{6} = 5 \\cdot \\tfrac{6}{5} = 6 \\text{ dní}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z19', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Kdo dostal větší podíl koláče? Klára dostala $\\dfrac{5}{8}$, Míša dostala $\\dfrac{7}{12}$.',
        kroky: [
          'Převeď na společného jmenovatele: NSN(8, 12) = 24.',
          '$\\frac{5}{8} = \\frac{?}{24}$, $\\frac{7}{12} = \\frac{?}{24}$. Srovnej čitatele.'
        ],
        odpoved: 'Klára ($\\dfrac{5}{8} > \\dfrac{7}{12}$)',
        jednotka: '',
        kontrola: (vstup) => normalizuj(vstup).includes('klár'),
        postup: [
          { latex: '\\tfrac{5}{8} = \\tfrac{15}{24},\\quad \\tfrac{7}{12} = \\tfrac{14}{24}', stav: 'krok' },
          { latex: '\\tfrac{15}{24} > \\tfrac{14}{24} \\Rightarrow \\text{Klára má více}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z20', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Vypočítej: $2\\dfrac{1}{3} \\cdot 1\\dfrac{1}{2}$',
        kroky: [
          'Převeď smíšená čísla na nepravé zlomky: $2\\frac{1}{3} = \\frac{?}{3}$, $1\\frac{1}{2} = \\frac{?}{2}$.',
          '$\\frac{7}{3} \\cdot \\frac{3}{2} = \\frac{21}{6} = ?$. Zjednoduš a případně zapiš jako smíšené číslo.'
        ],
        odpoved: '$3\\dfrac{1}{2}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('3.5') || n.includes('3,5') || (n.includes('3') && n.includes('1/2')) || blizko(vstup, 3.5);
        },
        postup: [
          { latex: '\\tfrac{7}{3} \\cdot \\tfrac{3}{2} = \\tfrac{21}{6} = \\tfrac{7}{2}', stav: 'krok' },
          { latex: '= 3\\tfrac{1}{2}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z21', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Ze zásoby bylo spotřebováno nejprve $\\dfrac{3}{8}$, potom $\\dfrac{5}{12}$. Kolik zásoby zbývá?',
        kroky: [
          'NSN(8, 12) = 24. Převeď: $\\frac{3}{8} = \\frac{?}{24}$, $\\frac{5}{12} = \\frac{?}{24}$.',
          'Spotřebováno celkem: $\\frac{9}{24} + \\frac{10}{24} = \\frac{19}{24}$.',
          'Zbývá: $1 - \\frac{19}{24} = ?$'
        ],
        odpoved: '$\\dfrac{5}{24}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('5/24') || n.includes('5 / 24') || blizko(vstup, 5/24);
        },
        postup: [
          { latex: '\\tfrac{9}{24} + \\tfrac{10}{24} = \\tfrac{19}{24}', stav: 'krok' },
          { latex: '1 - \\tfrac{19}{24} = \\tfrac{5}{24}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z22', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Vypočítej: $2\\dfrac{1}{4} \\div 1\\dfrac{1}{2}$',
        kroky: [
          'Převeď: $2\\frac{1}{4} = \\frac{9}{4}$, $1\\frac{1}{2} = \\frac{3}{2}$.',
          'Dělení = násobení převráceným: $\\frac{9}{4} \\cdot \\frac{2}{3} = ?$.'
        ],
        odpoved: '$\\dfrac{3}{2}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('3/2') || n.includes('1.5') || n.includes('1,5') || (n.includes('1') && n.includes('1/2')) || blizko(vstup, 1.5);
        },
        postup: [
          { latex: '\\tfrac{9}{4} \\div \\tfrac{3}{2} = \\tfrac{9}{4} \\cdot \\tfrac{2}{3} = \\tfrac{18}{12}', stav: 'krok' },
          { latex: '= \\tfrac{3}{2} = 1\\tfrac{1}{2}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z23', tridy: [7,8,9], podtyp: 'operace',
        zadani: 'Recept na 4 porce potřebuje $\\dfrac{3}{4}$ kg mouky. Kolik kg mouky je potřeba na 10 porcí?',
        kroky: [
          'Mouka na 1 porci: $\\frac{3}{4} \\div 4 = \\frac{3}{16}$ kg.',
          'Na 10 porcí: $10 \\cdot \\frac{3}{16} = \\frac{30}{16} = ?$ kg. Zjednoduš.'
        ],
        odpoved: '$1\\dfrac{7}{8}$ kg (= 1,875 kg)',
        jednotka: 'kg',
        kontrola: (vstup) => blizko(vstup, 1.875, 0.02),
        postup: [
          { latex: '\\tfrac{3}{4} \\div 4 = \\tfrac{3}{16} \\text{ kg/porci}', stav: 'krok' },
          { latex: '10 \\cdot \\tfrac{3}{16} = \\tfrac{30}{16} = \\tfrac{15}{8} = 1\\tfrac{7}{8} \\text{ kg}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z24', tridy: [6,7,8,9], podtyp: 'zakladni',
        zadani: 'Zkrať zlomek $\\dfrac{45}{75}$ na základní tvar.',
        kroky: [
          'Najdi NSD čísel 45 a 75. (Nápověda: zkus čísla 5, 15...)',
          'NSD(45, 75) = 15. Vydělej čitatele i jmenovatele 15.',
          '$\\frac{45 \\div 15}{75 \\div 15} = ?$'
        ],
        odpoved: '$\\dfrac{3}{5}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('3/5') || n.includes('3 / 5') || blizko(vstup, 3/5);
        },
        postup: [
          { latex: '\\text{NSD}(45, 75) = 15', stav: 'krok' },
          { latex: '\\frac{45}{75} = \\frac{3}{5}', stav: 'vysledek' }
        ]
      },
      {
        id: 'z25', tridy: [7,8,9], podtyp: 'zakladni',
        zadani: 'Jana přečetla $\\dfrac{3}{5}$ knihy, a to je 120 stránek. Kolik stránek má celá kniha?',
        kroky: [
          'Označme celkový počet stránek jako $x$. $\\frac{3}{5} \\cdot x = 120$.',
          '$x = 120 \\cdot \\frac{5}{3} = ?$'
        ],
        odpoved: '200 stránek',
        jednotka: 'stránek',
        kontrola: (vstup) => blizko(vstup, 200, 0.01),
        postup: [
          { latex: '\\tfrac{3}{5} \\cdot x = 120', stav: 'krok' },
          { latex: 'x = 120 \\cdot \\tfrac{5}{3} = 200 \\text{ stránek}', stav: 'vysledek' }
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
      },
      {
        // Záporný výsledek — přesun členů, celá čísla
        id: 'r6', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $4x + 7 = 2x - 3$',
        kroky: [
          'Přesuň členy s $x$ na levou stranu: $4x - 2x = ?$.',
          '$4x - 2x = -3 - 7 \\Rightarrow 2x = -10$.',
          '$x = ?$ (záporné číslo!)'
        ],
        odpoved: '$x = -5$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, -5, 0.01),
        postup: [
          { latex: '4x - 2x = -3 - 7', stav: 'krok' },
          { latex: '2x = -10 \\Rightarrow x = -5', stav: 'vysledek' }
        ]
      },
      {
        // Soustava — substituční metoda, dvě neznámé
        id: 'r7', tridy: [8,9], podtyp: 'soustava',
        zadani: 'Vyřeš soustavu rovnic:\n$x + 2y = 8$\n$3x - y = 3$',
        kroky: [
          'Z první rovnice vyjádři $x$: $x = 8 - 2y$. Dosaď do druhé rovnice.',
          '$3(8 - 2y) - y = 3 \\Rightarrow 24 - 6y - y = 3 \\Rightarrow -7y = -21 \\Rightarrow y = ?$',
          'Dosaď $y = 3$ do $x = 8 - 2y$: $x = ?$. Zkontroluj v druhé rovnici.'
        ],
        odpoved: '$x = 2$, $y = 3$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('2') && n.includes('3')) &&
                 (n.includes('x') || n.includes('y') || n.includes('='));
        },
        postup: [
          { latex: 'x = 8 - 2y \\Rightarrow 3(8-2y) - y = 3', stav: 'krok' },
          { latex: '-7y = -21 \\Rightarrow y = 3', stav: 'krok' },
          { latex: 'x = 8 - 6 = 2', stav: 'vysledek' }
        ]
      },
      {
        // Nerovnice se záporným koeficientem — otočení nerovnosti!
        id: 'r8', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Vyřeš nerovnici: $-2x + 3 \\geq 7$',
        kroky: [
          'Přesuň 3 doprava: $-2x \\geq 7 - 3 \\Rightarrow -2x \\geq 4$.',
          'Vydělíme $-2$ — při dělení záporným číslem se otočí nerovnost! $x \\leq ?$'
        ],
        odpoved: '$x \\leq -2$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('x') && (n.includes('<= -2') || n.includes('≤ -2') || n.includes('-2')) || blizko(vstup, -2, 0.01);
        },
        postup: [
          { latex: '-2x \\geq 4', stav: 'krok' },
          { latex: 'x \\leq -2 \\quad\\text{(otočení nerovnosti!)}', stav: 'vysledek' }
        ]
      },
      {
        // Zlomková rovnice — NSN, výsledek celé číslo
        id: 'r9', tridy: [8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $\\dfrac{2x}{3} = \\dfrac{x}{4} + \\dfrac{5}{6}$',
        kroky: [
          'NSN(3, 4, 6) = 12. Vynásob celou rovnici 12.',
          '$12 \\cdot \\frac{2x}{3} = 12 \\cdot \\frac{x}{4} + 12 \\cdot \\frac{5}{6} \\Rightarrow 8x = 3x + 10$.',
          '$8x - 3x = 10 \\Rightarrow 5x = 10 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 2$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 2, 0.01),
        postup: [
          { latex: '8x = 3x + 10', stav: 'krok' },
          { latex: '5x = 10 \\Rightarrow x = 2', stav: 'vysledek' }
        ]
      },
      {
        // Rovnice s absolutní hodnotou — ověření obou větví
        id: 'r10', tridy: [8,9], podtyp: 'absolutni',
        zadani: 'Vyřeš rovnici: $|3x + 6| = 9$',
        kroky: [
          '$|A| = 9$ má dvě větve: $A = 9$ nebo $A = -9$. Zapiš obě rovnice.',
          'Větev 1: $3x + 6 = 9 \\Rightarrow 3x = 3 \\Rightarrow x = ?$',
          'Větev 2: $3x + 6 = -9 \\Rightarrow 3x = -15 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 1$ nebo $x = -5$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('1') && (n.includes('-5') || n.includes('−5'));
        },
        postup: [
          { latex: '3x + 6 = 9 \\Rightarrow x = 1', stav: 'krok' },
          { latex: '3x + 6 = -9 \\Rightarrow x = -5', stav: 'krok' },
          { latex: 'x = 1 \\text{ nebo } x = -5', stav: 'vysledek' }
        ]
      },
      {
        id: 'r11', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $2(3x - 1) - 3(x + 2) = 7$',
        kroky: [
          'Rozbal závorky: $6x - 2 - 3x - 6 = 7$.',
          'Sjednoť: $3x - 8 = 7$.',
          '$3x = 15 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 5$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 5, 0.01),
        postup: [
          { latex: '6x - 2 - 3x - 6 = 7 \\Rightarrow 3x - 8 = 7', stav: 'krok' },
          { latex: 'x = 5', stav: 'vysledek' }
        ]
      },
      {
        id: 'r12', tridy: [8,9], podtyp: 'soustava',
        zadani: 'Na kino šlo 20 lidí. Dospělý zaplatil 180 Kč, student 120 Kč. Celkem zaplatili 2 880 Kč. Kolik bylo studentů?',
        kroky: [
          'Soustava: $d + s = 20$ a $180d + 120s = 2\\,880$. Z první: $d = 20 - s$.',
          '$180(20 - s) + 120s = 2\\,880 \\Rightarrow 3\\,600 - 60s = 2\\,880$.',
          '$-60s = -720 \\Rightarrow s = ?$'
        ],
        odpoved: '12 studentů',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 12, 0.01),
        postup: [
          { latex: '3\\,600 - 60s = 2\\,880', stav: 'krok' },
          { latex: 's = 12 \\text{ studentů}', stav: 'vysledek' }
        ]
      },
      {
        id: 'r13', tridy: [8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $\\dfrac{x}{3} + \\dfrac{x}{4} = 7$',
        kroky: [
          'NSN(3, 4) = 12. Vynásob celou rovnici 12.',
          '$12 \\cdot \\frac{x}{3} + 12 \\cdot \\frac{x}{4} = 84 \\Rightarrow 4x + 3x = 84$.',
          '$7x = 84 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 12$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 12, 0.01),
        postup: [
          { latex: '4x + 3x = 84 \\Rightarrow 7x = 84', stav: 'krok' },
          { latex: 'x = 12', stav: 'vysledek' }
        ]
      },
      {
        id: 'r14', tridy: [8,9], podtyp: 'linearni',
        zadani: 'Vyřeš dvojitou nerovnici: $-3 < 2x + 1 \\leq 7$',
        kroky: [
          'Odečti 1 od všech tří částí: $-3 - 1 < 2x \\leq 7 - 1$.',
          '$-4 < 2x \\leq 6$. Vyděl vším 2.',
          '$? < x \\leq ?$'
        ],
        odpoved: '$-2 < x \\leq 3$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('-2') && n.includes('3');
        },
        postup: [
          { latex: '-4 < 2x \\leq 6', stav: 'krok' },
          { latex: '-2 < x \\leq 3', stav: 'vysledek' }
        ]
      },
      {
        id: 'r15', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $5 - 3x = 2x - 10$',
        kroky: [
          'Přesuň členy s $x$ na pravou stranu a čísla na levou.',
          '$5 + 10 = 2x + 3x \\Rightarrow 15 = 5x$.',
          '$x = ?$'
        ],
        odpoved: '$x = 3$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 3, 0.01),
        postup: [
          { latex: '5 + 10 = 2x + 3x \\Rightarrow 15 = 5x', stav: 'krok' },
          { latex: 'x = 3', stav: 'vysledek' }
        ]
      },
      {
        id: 'r16', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Adam myslí na číslo. Přičte k němu 17 a pak výsledek znásobí 3. Dostane 75. Na jaké číslo myslel?',
        kroky: [
          'Označ hledané číslo jako $x$. Zapiš rovnici: $3(x + 17) = 75$.',
          '$x + 17 = 25 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 8$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 8, 0.01),
        postup: [
          { latex: '3(x + 17) = 75 \\Rightarrow x + 17 = 25', stav: 'krok' },
          { latex: 'x = 8', stav: 'vysledek' }
        ]
      },
      {
        id: 'r17', tridy: [8,9], podtyp: 'soustava',
        zadani: 'Vyřeš soustavu rovnic:\n$x + y = 10$\n$2x - y = 2$',
        kroky: [
          'Sečti obě rovnice: $(x + y) + (2x - y) = 10 + 2$.',
          '$3x = 12 \\Rightarrow x = ?$. Dosaď do první rovnice.',
          '$4 + y = 10 \\Rightarrow y = ?$'
        ],
        odpoved: '$x = 4$, $y = 6$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('4') && n.includes('6')) &&
                 (n.includes('x') || n.includes('y') || n.includes('='));
        },
        postup: [
          { latex: '3x = 12 \\Rightarrow x = 4', stav: 'krok' },
          { latex: 'y = 10 - 4 = 6', stav: 'krok' },
          { latex: 'x = 4,\\quad y = 6', stav: 'vysledek' }
        ]
      },
      {
        id: 'r18', tridy: [8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $\\dfrac{2x - 3}{5} = \\dfrac{x + 1}{3}$',
        kroky: [
          'Zkříženě násobíme: $3(2x - 3) = 5(x + 1)$.',
          '$6x - 9 = 5x + 5$.',
          '$x = ?$'
        ],
        odpoved: '$x = 14$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 14, 0.01),
        postup: [
          { latex: '3(2x-3) = 5(x+1) \\Rightarrow 6x - 9 = 5x + 5', stav: 'krok' },
          { latex: 'x = 14', stav: 'vysledek' }
        ]
      },
      {
        id: 'r19', tridy: [8,9], podtyp: 'absolutni',
        zadani: 'Vyřeš rovnici: $|x - 3| = 5$',
        kroky: [
          '$|A| = 5$ má dvě větve: $A = 5$ nebo $A = -5$.',
          'Větev 1: $x - 3 = 5 \\Rightarrow x = ?$',
          'Větev 2: $x - 3 = -5 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = 8$ nebo $x = -2$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('8') && (n.includes('-2') || n.includes('−2'));
        },
        postup: [
          { latex: 'x - 3 = 5 \\Rightarrow x = 8', stav: 'krok' },
          { latex: 'x - 3 = -5 \\Rightarrow x = -2', stav: 'krok' },
          { latex: 'x = 8 \\text{ nebo } x = -2', stav: 'vysledek' }
        ]
      },
      {
        id: 'r20', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $4(x + 2) = 3(x - 1) + 15$',
        kroky: [
          'Rozbal závorky: $4x + 8 = 3x - 3 + 15$.',
          '$4x + 8 = 3x + 12$.',
          '$x = ?$'
        ],
        odpoved: '$x = 4$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 4, 0.01),
        postup: [
          { latex: '4x + 8 = 3x + 12', stav: 'krok' },
          { latex: 'x = 4', stav: 'vysledek' }
        ]
      },
      {
        id: 'r21', tridy: [7,8,9], podtyp: 'linearni',
        zadani: 'Nerovnici $-2x + 3 > 9$ vyřeš a výsledek zapiš na číselné ose (slovně: $x < ?$ nebo $x > ?$).',
        kroky: [
          '$-2x + 3 > 9 \\Rightarrow -2x > 6$.',
          'Při dělení záporným číslem se otočí nerovnost: $x < ?$'
        ],
        odpoved: '$x < -3$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('-3') || blizko(vstup, -3, 0.01);
        },
        postup: [
          { latex: '-2x > 6', stav: 'krok' },
          { latex: 'x < -3 \\quad\\text{(otočení nerovnosti)}', stav: 'vysledek' }
        ]
      },
      {
        id: 'r22', tridy: [8,9], podtyp: 'linearni',
        zadani: 'Najdi všechna celá čísla $x$, pro která platí: $2 \\leq 3x - 7 < 8$',
        kroky: [
          'Přičti 7 ke všem částem: $9 \\leq 3x < 15$.',
          'Vyděl 3: $3 \\leq x < 5$.',
          'Celá čísla v tomto rozsahu jsou?'
        ],
        odpoved: '$x \\in \\{3,\\ 4\\}$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('3') && n.includes('4');
        },
        postup: [
          { latex: '9 \\leq 3x < 15 \\Rightarrow 3 \\leq x < 5', stav: 'krok' },
          { latex: 'x \\in \\{3,\\ 4\\}', stav: 'vysledek' }
        ]
      },
      {
        id: 'r23', tridy: [8,9], podtyp: 'soustava',
        zadani: 'Vyřeš soustavu rovnic:\n$x + 2y = 8$\n$2x - y = 6$',
        kroky: [
          'Z první rovnice: $x = 8 - 2y$. Dosaď do druhé.',
          '$2(8 - 2y) - y = 6 \\Rightarrow 16 - 4y - y = 6 \\Rightarrow -5y = -10 \\Rightarrow y = ?$',
          '$y = 2$. Dosaď: $x = 8 - 4 = ?$'
        ],
        odpoved: '$x = 4$, $y = 2$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return (n.includes('4') && n.includes('2')) &&
                 (n.includes('x') || n.includes('y') || n.includes('='));
        },
        postup: [
          { latex: '-5y = -10 \\Rightarrow y = 2', stav: 'krok' },
          { latex: 'x = 8 - 4 = 4', stav: 'krok' },
          { latex: 'x = 4,\\quad y = 2', stav: 'vysledek' }
        ]
      },
      {
        id: 'r24', tridy: [8,9], podtyp: 'absolutni',
        zadani: 'Vyřeš nerovnici s absolutní hodnotou: $|x - 2| < 4$',
        kroky: [
          '$|A| < 4$ znamená $-4 < A < 4$. Dosaď $A = x - 2$.',
          '$-4 < x - 2 < 4$. Přičti 2 ke všem částem.',
          '$? < x < ?$'
        ],
        odpoved: '$-2 < x < 6$',
        jednotka: '',
        kontrola: (vstup) => {
          const n = normalizuj(vstup);
          return n.includes('-2') && n.includes('6');
        },
        postup: [
          { latex: '-4 < x - 2 < 4', stav: 'krok' },
          { latex: '-2 < x < 6', stav: 'vysledek' }
        ]
      },
      {
        id: 'r25', tridy: [8,9], podtyp: 'linearni',
        zadani: 'Vyřeš rovnici: $\\dfrac{3x + 1}{4} - \\dfrac{x - 2}{2} = 1$',
        kroky: [
          'NSN(4, 2) = 4. Vynásob celou rovnici 4.',
          '$3x + 1 - 2(x - 2) = 4 \\Rightarrow 3x + 1 - 2x + 4 = 4$.',
          '$x + 5 = 4 \\Rightarrow x = ?$'
        ],
        odpoved: '$x = -1$',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, -1, 0.01),
        postup: [
          { latex: '3x + 1 - 2(x-2) = 4 \\Rightarrow x + 5 = 4', stav: 'krok' },
          { latex: 'x = -1', stav: 'vysledek' }
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
      },
      {
        // Obvod rovnoramenného trojúhelníku — odvození délky ramene
        id: 'g6', tridy: [6,7,8,9], podtyp: 'obvod',
        zadani: 'Rovnoramenný trojúhelník má obvod 38 cm a základnu délky 10 cm. Jak dlouhá jsou ramena?',
        kroky: [
          'Obvod $= 2 \\cdot$ rameno $+$ základna. Zapiš rovnici: $2r + 10 = 38$.',
          '$2r = 38 - 10 = 28 \\Rightarrow r = ?$'
        ],
        odpoved: '14 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 14, 0.01),
        postup: [
          { latex: '2r + 10 = 38', stav: 'krok' },
          { latex: '2r = 28 \\Rightarrow r = 14 \\text{ cm}', stav: 'vysledek' }
        ]
      },
      {
        // Obsah obdélníku ze zadání obvodu a vztahu stran
        id: 'g7', tridy: [6,7,8,9], podtyp: 'obsah_zakladni',
        zadani: 'Obdélník má obvod 34 cm. Délka je o 5 cm větší než šířka. Jaký je obsah obdélníku?',
        kroky: [
          'Označ šířku $= w$, délku $= w + 5$. Obvod: $2(w + w + 5) = 34$.',
          '$2(2w + 5) = 34 \\Rightarrow 4w + 10 = 34 \\Rightarrow w = ?$',
          'Šířka $= 6$ cm, délka $= 11$ cm. Obsah $= 6 \\cdot 11 = ?$'
        ],
        odpoved: '$66\\text{ cm}^2$',
        jednotka: 'cm²',
        kontrola: (vstup) => blizko(vstup, 66, 0.01),
        postup: [
          { latex: '4w + 10 = 34 \\Rightarrow w = 6 \\text{ cm}', stav: 'krok' },
          { latex: 'S = 6 \\cdot 11 = 66 \\text{ cm}^2', stav: 'vysledek' }
        ]
      },
      {
        // Obsah kosočtverce z uhlopříček
        id: 'g8', tridy: [8,9], podtyp: 'obsah_zakladni',
        zadani: 'Kosočtverec má uhlopříčky délky 8 cm a 6 cm. Jaký je jeho obsah?',
        kroky: [
          'Obsah kosočtverce: $S = \\frac{d_1 \\cdot d_2}{2}$. Dosaď $d_1 = 8$, $d_2 = 6$.',
          '$S = \\frac{8 \\cdot 6}{2} = ?$'
        ],
        odpoved: '$24\\text{ cm}^2$',
        jednotka: 'cm²',
        kontrola: (vstup) => blizko(vstup, 24, 0.01),
        postup: [
          { latex: 'S = \\frac{d_1 \\cdot d_2}{2} = \\frac{8 \\cdot 6}{2}', stav: 'krok' },
          { latex: 'S = 24 \\text{ cm}^2', stav: 'vysledek' }
        ]
      },
      {
        // Objem válce — π × r² × h, desetinné číslo
        id: 'g9', tridy: [8,9], podtyp: 'obsah_zakladni',
        zadani: 'Válec má poloměr základny 3 cm a výšku 10 cm. Jaký je jeho objem? (použij $\\pi \\approx 3{,}14$)',
        kroky: [
          'Vzorec: $V = \\pi \\cdot r^2 \\cdot h$. Dosaď $r = 3$, $h = 10$, $\\pi = 3{,}14$.',
          '$V = 3{,}14 \\cdot 9 \\cdot 10 = ?$'
        ],
        odpoved: '$282{,}6\\text{ cm}^3$',
        jednotka: 'cm³',
        kontrola: (vstup) => blizko(vstup, 282.6, 0.5),
        postup: [
          { latex: 'V = 3{,}14 \\cdot 3^2 \\cdot 10 = 3{,}14 \\cdot 9 \\cdot 10', stav: 'krok' },
          { latex: 'V = 282{,}6 \\text{ cm}^3', stav: 'vysledek' }
        ]
      },
      {
        // Povrch kvádru — sečtení ploch šesti stěn
        id: 'g10', tridy: [8,9], podtyp: 'obsah_zakladni',
        zadani: 'Kvádr má rozměry 5 cm × 3 cm × 4 cm. Jaký je jeho povrch?',
        kroky: [
          'Povrch kvádru $= 2(ab + bc + ac)$, kde $a = 5$, $b = 3$, $c = 4$.',
          '$ab = 5 \\cdot 3 = 15$, $bc = 3 \\cdot 4 = 12$, $ac = 5 \\cdot 4 = 20$.',
          '$S = 2(15 + 12 + 20) = 2 \\cdot ? = ?$'
        ],
        odpoved: '$94\\text{ cm}^2$',
        jednotka: 'cm²',
        kontrola: (vstup) => blizko(vstup, 94, 0.01),
        postup: [
          { latex: 'ab + bc + ac = 15 + 12 + 20 = 47', stav: 'krok' },
          { latex: 'S = 2 \\cdot 47 = 94 \\text{ cm}^2', stav: 'vysledek' }
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
      },
      {
        // Medián z uspořádané tabulky
        id: 'gr4', tridy: [8,9], podtyp: 'prumery',
        zadani: 'Tabulka výšek 5 žáků: 165, 172, 168, 170, 175 cm. Jaký je medián výšek?',
        kroky: [
          'Medián = hodnota uprostřed uspořádané řady. Seřaď čísla od nejmenšího.',
          'Seřazeno: 165, 168, 170, 172, 175. Uprostřed je $?$. číslo.',
          '5 hodnot → prostřední je 3. v pořadí. Jaká výška je na 3. místě?'
        ],
        odpoved: '170 cm',
        jednotka: 'cm',
        kontrola: (vstup) => blizko(vstup, 170, 0.01),
        postup: [
          { latex: '\\text{seřazeno: } 165, 168, \\mathbf{170}, 172, 175', stav: 'krok' },
          { latex: '\\text{medián} = 170 \\text{ cm}', stav: 'vysledek' }
        ]
      },
      {
        // Minimální body pro daný průměr — nerovnice
        id: 'gr5', tridy: [8,9], podtyp: 'prumery',
        zadani: 'Žák má ve čtyřech testech výsledky: 80, 65, 90, 75 bodů. Kolik bodů musí dostat v pátém testu, aby byl průměr alespoň 80?',
        kroky: [
          'Průměr 5 testů $\\geq 80$: $\\frac{80 + 65 + 90 + 75 + x}{5} \\geq 80$.',
          'Součet čtyř testů $= ?$. Celý součet musí být $\\geq 5 \\cdot 80 = 400$.',
          '$310 + x \\geq 400 \\Rightarrow x \\geq ?$'
        ],
        odpoved: 'Alespoň 90 bodů',
        jednotka: 'bodů',
        kontrola: (vstup) => blizko(vstup, 90, 0.01),
        postup: [
          { latex: '80 + 65 + 90 + 75 = 310', stav: 'krok' },
          { latex: '310 + x \\geq 400 \\Rightarrow x \\geq 90', stav: 'vysledek' }
        ]
      },
      {
        // Koláčový graf — přepočet procent na úhel
        id: 'gr6', tridy: [8,9], podtyp: 'cteni_dat',
        zadani: 'V koláčovém grafu odpovídá 25 % hodnotě 90°. Jak velký úhel odpovídá 40 %?',
        kroky: [
          'Nastav přepočet: $25\\,\\% \\to 90°$. Kolik stupňů odpovídá 1 %?',
          '$1\\,\\% = \\frac{90}{25} = 3{,}6°$. Pro 40 %: $40 \\cdot 3{,}6 = ?°$'
        ],
        odpoved: '144°',
        jednotka: '°',
        kontrola: (vstup) => blizko(vstup, 144, 0.1),
        postup: [
          { latex: '1\\,\\% = \\frac{90°}{25} = 3{,}6°', stav: 'krok' },
          { latex: '40 \\cdot 3{,}6° = 144°', stav: 'vysledek' }
        ]
      },
      {
        // Čtení z grafu — průměr kvartálních hodnot
        id: 'gr7', tridy: [8,9], podtyp: 'cteni_dat',
        zadani: 'Z grafu prodeje: Q1 = 300, Q2 = 420, Q3 = 380, Q4 = 460 výrobků. Jaký je průměrný kvartální prodej?',
        kroky: [
          'Průměr $= \\frac{\\text{součet všech hodnot}}{\\text{počet kvartálů}}$.',
          '$300 + 420 + 380 + 460 = ?$. Vyděl 4.'
        ],
        odpoved: '390 výrobků',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 390, 0.01),
        postup: [
          { latex: '300 + 420 + 380 + 460 = 1\\,560', stav: 'krok' },
          { latex: '\\frac{1\\,560}{4} = 390 \\text{ výrobků}', stav: 'vysledek' }
        ]
      },
      {
        // Chybějící hodnota v tabulce při znalosti průměru
        id: 'gr8', tridy: [8,9], podtyp: 'prumery',
        zadani: 'Průměrná teplota za 5 dní byla 15 °C. Naměřené teploty byly: 12, 18, 14, 16 a neznámá hodnota $x$. Jaká teplota byla pátý den?',
        kroky: [
          'Součet všech 5 hodnot $= 5 \\cdot 15 = ?$.',
          'Součet 4 známých: $12 + 18 + 14 + 16 = ?$.',
          '$x = 75 - ?$'
        ],
        odpoved: '15 °C',
        jednotka: '°C',
        kontrola: (vstup) => blizko(vstup, 15, 0.01),
        postup: [
          { latex: '\\text{součet} = 5 \\cdot 15 = 75', stav: 'krok' },
          { latex: '12 + 18 + 14 + 16 = 60', stav: 'krok' },
          { latex: 'x = 75 - 60 = 15 \\text{ °C}', stav: 'vysledek' }
        ]
      },
      {
        // Čtení z tabulky — základní aritmetika s více položkami
        id: 'gr9', tridy: [8,9], podtyp: 'cteni_dat',
        zadani: 'Ceník zeleniny (Kč/kg): brambory 12, mrkev 18, cibule 15. Zákazník koupil 3 kg brambor, 1 kg mrkve a 2 kg cibule. Kolik zaplatil celkem?',
        kroky: [
          'Spočítej cenu každé položky zvlášť: brambory $= 3 \\cdot 12$, mrkev $= 1 \\cdot 18$, cibule $= 2 \\cdot 15$.',
          'Sečti: $36 + 18 + 30 = ?$ Kč.'
        ],
        odpoved: '84 Kč',
        jednotka: 'Kč',
        kontrola: (vstup) => blizko(vstup, 84, 0.01),
        postup: [
          { latex: '3 \\cdot 12 + 1 \\cdot 18 + 2 \\cdot 15 = 36 + 18 + 30', stav: 'krok' },
          { latex: '= 84 \\text{ Kč}', stav: 'vysledek' }
        ]
      },
      {
        // Procentní podíl ze součtu — záporný mezivýsledek nerelevantní, ale reálný kontext
        id: 'gr10', tridy: [8,9], podtyp: 'cteni_dat',
        zadani: 'Z grafu: škola má celkem 250 žáků, z toho 48 % jsou chlapci. Kolik je dívek?',
        kroky: [
          'Počet chlapců $= 48\\,\\% \\cdot 250 = 0{,}48 \\cdot 250 = ?$.',
          'Dívky $= 250 - ?$'
        ],
        odpoved: '130 dívek',
        jednotka: '',
        kontrola: (vstup) => blizko(vstup, 130, 0.01),
        postup: [
          { latex: '0{,}48 \\cdot 250 = 120 \\text{ chlapců}', stav: 'krok' },
          { latex: '250 - 120 = 130 \\text{ dívek}', stav: 'vysledek' }
        ]
      }
    ]
  }
];
