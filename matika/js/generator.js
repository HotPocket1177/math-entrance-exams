// generator.js — dynamické generování úloh pomocí AI
// Každá sada 5 příkladů je vygenerována na míru danému tématu a třídě.
// Pokud AI selže, app.js přejde na statický fallback (ulohy.js).

const Generator = (() => {

  const TEMA_POPIS = {
    slovni:    'Slovní úlohy — soustava rovnic, poměry, pohyb, věk, společná práce, směsi',
    procenta:  'Procenta — zpětný výpočet, složené změny, DPH, procentní nárůst/pokles',
    zlomky:    'Zlomky — operace (sčítání, odčítání, násobení, dělení), zjednodušení, smíšená čísla, reálný kontext',
    rovnice:   'Rovnice a nerovnice — lineární rovnice, soustavy dvou neznámých, zlomkové rovnice, absolutní hodnota',
    geometrie: 'Geometrie — obsah a obvod rovinných útvarů, Pythagorova věta, tělesa (objem/povrch), souřadnice',
    grafy:     'Grafy a tabulky — průměr, medián, modus, čtení dat z tabulky, procentní změny, lineární funkce',
  };

  // Vytvoří generickou kontrola() funkci z AI odpovědi
  function makeKontrola(prob) {
    return (vstup) => {
      const type = prob.answerType;

      // cislo() a blizko() jsou z ulohy.js — rozumí zlomkům, „1 7/8“, „69 m2“…
      // a celé výsledky porovnávají přesně (AI často posílá toleranci 5 %).
      if (type === 'number') {
        const target = Number(prob.answerValue);
        if (isNaN(target)) return false;
        return blizko(vstup, target, prob.tolerance ?? 0.005);
      }

      if (type === 'keywords') {
        const n = normalizuj(vstup);
        return (prob.keywords || []).every(kw => obsahujeVyraz(n, normalizuj(String(kw))));
      }

      // Fallback: číselná shoda, jinak celá odpověď (ne jen její kousek)
      const ans = normalizuj(prob.odpoved || '');
      const hodnota = cislo(ans);
      if (!isNaN(hodnota)) return blizko(vstup, hodnota);
      const n = normalizuj(vstup);
      return n.length >= 3 && (n === ans || ans.includes(n) && n.length >= ans.length / 2);
    };
  }

  // „24“ nesmí najít „124“ ani „3/4“ v „13/4“ — výraz musí stát samostatně
  function obsahujeVyraz(text, vyraz) {
    if (!vyraz) return true;
    const esc = vyraz.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\d.,/])${esc}(?![\\d/]|[.,]\\d)`).test(text);
  }

  // Ukázky čistě početních zadání (bez slovního kontextu) pro témata, kde to jde
  const PRIKLADY_BEZ_KONTEXTU = {
    zlomky:    '"Vypočítej: $\\frac{3}{4} - \\frac{1}{6}$", "Zkrať na základní tvar: $\\frac{42}{56}$", "Vypočítej: $2\\frac{1}{3} \\cdot \\frac{3}{14}$"',
    procenta:  '"Kolik je 15 % z 240?", "Kolik procent je 36 z 48?", "Urči číslo, jehož 30 % je 120."',
    rovnice:   '"Vyřeš rovnici: $3(x - 2) = x + 8$", "Vyřeš soustavu: $x + y = 9$, $2x - y = 3$", "Vyřeš nerovnici: $5 - 2x > 11$"',
    geometrie: '"Obdélník má strany 4,5 cm a 6 cm. Vypočítej jeho obsah.", "Pravoúhlý trojúhelník má odvěsny 5 cm a 12 cm. Urči délku přepony."'
  };

  // slovni = true → úloha s reálným kontextem (slovní úloha); false → čistý početní příklad
  function buildPrompt(temaId, trida, slovni) {
    const tema = slovni
      ? (TEMA_POPIS[temaId] || temaId)
      : (TEMA_POPIS[temaId] || temaId).replace(/,?\s*reálný kontext/, '');
    const krok1 = slovni
      ? 'Vymysli zadání s realistickým kontextem a pěknými čísly.'
      : 'Vymysli ČISTĚ početní zadání BEZ slovního kontextu a pěkná čísla.';
    const kontext = slovni
      ? '- Realistický kontext (ne abstraktní "číslo x")'
      : `- ŽÁDNÝ příběh ani kontext (žádné ceny zboží, osoby, recepty…) — jen krátký pokyn a matematický výraz
- Ukázky stylu: ${PRIKLADY_BEZ_KONTEXTU[temaId] || '"Vypočítej: …"'}`;

    return `Jsi generátor matematických příkladů pro přijímací zkoušky na střední školy v ČR (styl CERMAT, 4leté obory).

Téma: ${tema}
Třída žáka: ${trida}. třída
Typ úlohy: ${slovni ? 'slovní úloha' : 'početní příklad bez kontextu'}

POSTUP TVORBY (dodržuj pořadí):
1. ${krok1}
2. PŘESNĚ VYPOČÍTEJ správnou odpověď (krok za krokem v hlavě).
3. Zapište výpočetní kroky (postup) — každý krok musí numericky navazovat na předchozí a vést k výsledku z bodu 2.
4. Ověř: dosad výsledek zpět do zadání a zkontroluj, že sedí.
5. Teprve pak vytvoř JSON.

Požadavky:
${kontext}
- Správná matematika, pěkná celá nebo desetinná čísla (ne nahodilá zlomky)
- Obtížnost odpovídající přijímačkám na střední školu
- Zadání a kroky v češtině, matematika v LaTeX ($...$)
- kroky[] = sokratovské nápovědy (nasměrují žáka otázkou, NEříkají výsledek)
- postup[] = PŘESNÉ výpočetní kroky; poslední krok MUSÍ obsahovat finální číslo shodné s answerValue

Vrať VÝHRADNĚ validní JSON (žádný text mimo JSON):
{
  "zadani": "text zadání (LaTeX v $...$)",
  "kroky": ["nápovědná otázka 1", "nápovědná otázka 2", "nápovědná otázka 3"],
  "odpoved": "text správné odpovědi (krátce)",
  "postup": [
    {"latex": "první výpočetní krok v LaTeX", "popis": "Co v tomto kroku děláme a proč — 1 věta česky, srozumitelně pro 8. třídu", "stav": "krok"},
    {"latex": "druhý výpočetní krok", "popis": "Vysvětlení operace — pojmenuj co se dělá (odečítáme, dosazujeme, vydělíme...)", "stav": "krok"},
    {"latex": "finální výsledek = answerValue", "popis": "Výsledek — co jsme vypočítali a co to znamená v kontextu zadání", "stav": "vysledek"}
  ],
  "plan": ["Pojmenuj neznámou", "Sestav rovnici", "Vyřeš rovnici"],
  "zacatek": [
    {"text": "správný první krok", "spravne": true, "proc": "proč je to dobrý začátek"},
    {"text": "věrohodný, ale špatný začátek", "spravne": false, "proc": "proč to nevede k cíli"},
    {"text": "jiný věrohodný, ale špatný začátek", "spravne": false, "proc": "proč to nevede k cíli"}
  ],
  "answerType": "number",
  "answerValue": 42.5,
  "tolerance": 0.005
}

PRAVIDLA PRO postup[]:
- Každý krok MUSÍ mít pole "popis" — krátké (max 2 věty) česky psané vysvětlení
- Popis vysvětluje CO děláme (pojmenuj operaci: "Odečteme...", "Dosadíme...", "Vydělíme obě strany...") a PROČ
- Popis musí být pochopitelný žákovi 8.–9. třídy bez dalšího vysvětlení
- Poslední krok má stav "vysledek" a jeho latex obsahuje finální číslo
- V poli "latex" NIKDY nepíš $ ani $$ — piš čistý LaTeX bez delimitérů (např. "x = 5", ne "$x = 5$")
- Je to JSON: každé zpětné lomítko v LaTeXu zdvoj (např. "\\\\frac{1}{2}", "2 \\\\cdot 3")
- Desetinná čárka v poli "latex": piš {,} místo , (např. "4{,}5" ne "4,5") — jinak se vykreslí mezera
- V polích "odpoved", "popis" a "zadani" (mimo $...$) piš normální čárku (,) — NIKDY nepíš {,} v běžném textu
- Pro "answerType": "keywords" musí poslední krok v postup[] obsahovat výpočet s čísly z "keywords" — ne jiné hodnoty

PRAVIDLA PRO plan[] a zacatek[]:
- plan[] = 2–5 krátkých názvů kroků řešení (max 6 slov), BEZ čísel a výsledků
- zacatek[] = přesně 3 možnosti, jak úlohu ZAČÍT; právě jedna "spravne": true
- Špatné možnosti musí být věrohodné — typické chyby žáků (špatný základ procent, sečtení místo odečtení, záměna obvodu a obsahu…)
- "text" max 12 slov, "proc" jedna věta; nikde neprozrazuj výsledek

Pro slovní úlohy s více hodnotami (soustava) použij "answerType": "keywords", "keywords": ["hodnota1", "hodnota2"].
Pro geometrii/výpočty s jedním výsledkem vždy "answerType": "number" (answerValue jako desetinné číslo, např. 0.75 pro tři čtvrtiny).
Pokud úloha výslovně žádá zápis zlomku v základním tvaru nebo smíšeného čísla, použij "answerType": "keywords" s přesným zápisem, např. "keywords": ["3/4"] nebo ["4 1/7"].
"tolerance" nech 0.005 — jen na zaokrouhlení; celé výsledky se kontrolují přesně.`;
  }

  // Vygeneruje jeden příklad
  async function generujUlohu(temaId, trida, index, slovni = true) {
    const messages = [
      { role: 'system', content: buildPrompt(temaId, trida, slovni) },
      {
        role: 'user',
        content: slovni
          ? `Vygeneruj příklad ${index + 1}. Musí se lišit od typických učebnicových příkladů — zvol jiný kontext nebo číselné hodnoty.`
          : `Vygeneruj příklad ${index + 1}. Bez slovního kontextu — zvol jiná čísla a jiný typ operace než obvykle.`
      }
    ];

    const raw = await Api.chat(messages, { maxTokens: 8000, effort: 'medium' });

    // AI může zabalit JSON do ```json…``` a psát LaTeX s jedním lomítkem — parseJson to zvládne
    const prob = Api.parseJson(raw);
    if (!prob) throw new Error(`AI nevrátila platný JSON (index ${index})`);

    // Validace povinných polí
    if (!prob.zadani || !prob.odpoved) throw new Error('Neúplný JSON od AI');

    // Odstraň {,} z textových polí — tam patří jen normální čárka
    prob.odpoved = prob.odpoved.replace(/\{,\}/g, ',');

    // Ověř postup: poslední krok musí odpovídat výsledku (jinak kroky odstraníme)
    let postupOvereny = Array.isArray(prob.postup) ? prob.postup : [];
    if (postupOvereny.length > 0) {
      const posledniLatex = (postupOvereny[postupOvereny.length - 1]?.latex || '').toLowerCase();

      if (prob.answerType === 'number' && prob.answerValue != null) {
        const num = String(prob.answerValue);
        const intPart = num.split('.')[0];
        const sedí = posledniLatex.includes(num) ||
                     posledniLatex.includes(num.replace('.', ',')) ||
                     posledniLatex.includes(num.replace('.', '{,}')) ||
                     (intPart.length >= 3 && posledniLatex.includes(intPart));
        if (!sedí) postupOvereny = [];
      } else if (prob.answerType === 'keywords' && Array.isArray(prob.keywords) && prob.keywords.length > 0) {
        // Alespoň jedno klíčové číslo musí být v posledním kroku
        const nekteréKW = prob.keywords.some(kw => {
          const s = String(kw).replace(',', '.').toLowerCase();
          const intP = s.split('.')[0];
          return posledniLatex.includes(s) ||
                 posledniLatex.includes(s.replace('.', ',')) ||
                 posledniLatex.includes(s.replace('.', '{,}')) ||
                 (intP.length >= 2 && posledniLatex.includes(intP));
        });
        if (!nekteréKW) postupOvereny = [];
      }

      // Odstraň {,} z popis polí — zobrazují se jako plain text
      postupOvereny = postupOvereny.map(k => ({
        ...k,
        popis: (k.popis || '').replace(/\{,\}/g, ','),
      }));
    }

    return {
      id:       `gen_${temaId}_${Date.now()}_${index}`,
      temaId,
      slovni,
      tridy:    [6, 7, 8, 9],
      podtyp:   'generovany',
      zadani:   prob.zadani,
      kroky:    Array.isArray(prob.kroky)  ? prob.kroky  : [],
      odpoved:  prob.odpoved,
      jednotka: prob.jednotka || '',
      postup:   postupOvereny,
      // Engine plan/zacatek validuje; neplatné doplní AI při přípravě úlohy
      plan:     Array.isArray(prob.plan)    ? prob.plan    : null,
      zacatek:  Array.isArray(prob.zacatek) ? prob.zacatek : null,
      kontrola: makeKontrola(prob),
      _meta:    { answerType: prob.answerType, answerValue: prob.answerValue, tolerance: prob.tolerance ?? 0.05, keywords: prob.keywords || [] },
    };
  }

  // Vygeneruje sadu count příkladů paralelně, s retry při selhání.
  // temaId může být i pole (Mix) — i-tý příklad pak bude z tématu temaId[i].
  // slovni: true/false pro celou sadu, nebo pole (Mix) — typ i-tého příkladu.
  async function generujSadu(temaId, trida, count = 5, onProgress, slovni = true) {
    const promises = Array.from({ length: count }, async (_, i) => {
      try {
        const tema  = Array.isArray(temaId) ? temaId[i % temaId.length] : temaId;
        const typ   = Array.isArray(slovni) ? slovni[i % slovni.length] : slovni;
        const uloha = await generujUlohu(tema, trida, i, typ);
        if (onProgress) onProgress(i + 1, count);
        return uloha;
      } catch (err) {
        console.warn(`Generator: příklad ${i} selhal:`, err.message);
        return null;
      }
    });

    const vysledky = await Promise.all(promises);
    const uspesne  = vysledky.filter(Boolean);

    if (uspesne.length < count) {
      throw new Error(`Vygenerováno pouze ${uspesne.length}/${count} příkladů`);
    }

    return uspesne;
  }

  return { generujSadu, makeKontrola };
})();
