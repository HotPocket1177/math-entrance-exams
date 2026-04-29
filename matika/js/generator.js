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

      if (type === 'number') {
        const tol = prob.tolerance ?? 0.05;
        const v = parseFloat(vstup.trim().replace(',', '.').replace(/[^0-9.\-]/g, ''));
        if (isNaN(v)) return false;
        const target = Number(prob.answerValue);
        return Math.abs(v - target) <= Math.abs(target) * tol + 0.001;
      }

      if (type === 'keywords') {
        const n = vstup.trim().replace(',', '.').toLowerCase();
        return (prob.keywords || []).every(kw =>
          n.includes(String(kw).replace(',', '.').toLowerCase())
        );
      }

      // Fallback: volná shoda s odpovědí
      const n = vstup.trim().toLowerCase();
      const ans = (prob.odpoved || '').toLowerCase();
      return n.length > 0 && (n.includes(ans.substring(0, 6)) || ans.includes(n.substring(0, 6)));
    };
  }

  function buildPrompt(temaId, trida) {
    return `Jsi generátor matematických příkladů pro přijímací zkoušky na střední školy v ČR (styl CERMAT, 4leté obory).

Téma: ${TEMA_POPIS[temaId] || temaId}
Třída žáka: ${trida}. třída

POSTUP TVORBY (dodržuj pořadí):
1. Vymysli zadání s realistickým kontextem a pěknými čísly.
2. PŘESNĚ VYPOČÍTEJ správnou odpověď (krok za krokem v hlavě).
3. Zapište výpočetní kroky (postup) — každý krok musí numericky navazovat na předchozí a vést k výsledku z bodu 2.
4. Ověř: dosad výsledek zpět do zadání a zkontroluj, že sedí.
5. Teprve pak vytvoř JSON.

Požadavky:
- Realistický kontext (ne abstraktní "číslo x")
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
  "answerType": "number",
  "answerValue": 42.5,
  "tolerance": 0.05
}

PRAVIDLA PRO postup[]:
- Každý krok MUSÍ mít pole "popis" — krátké (max 2 věty) česky psané vysvětlení
- Popis vysvětluje CO děláme (pojmenuj operaci: "Odečteme...", "Dosadíme...", "Vydělíme obě strany...") a PROČ
- Popis musí být pochopitelný žákovi 8.–9. třídy bez dalšího vysvětlení
- Poslední krok má stav "vysledek" a jeho latex obsahuje finální číslo
- V poli "latex" NIKDY nepíš $ ani $$ — piš čistý LaTeX bez delimitérů (např. "x = 5", ne "$x = 5$")
- Desetinná čárka v poli "latex": piš {,} místo , (např. "4{,}5" ne "4,5") — jinak se vykreslí mezera
- V polích "odpoved", "popis" a "zadani" (mimo $...$) piš normální čárku (,) — NIKDY nepíš {,} v běžném textu
- Pro "answerType": "keywords" musí poslední krok v postup[] obsahovat výpočet s čísly z "keywords" — ne jiné hodnoty

Pro slovní úlohy s více hodnotami (soustava) použij "answerType": "keywords", "keywords": ["hodnota1", "hodnota2"].
Pro geometrii/výpočty s jedním výsledkem vždy "answerType": "number".`;
  }

  // Vygeneruje jeden příklad
  async function generujUlohu(temaId, trida, index) {
    const messages = [
      { role: 'system', content: buildPrompt(temaId, trida) },
      {
        role: 'user',
        content: `Vygeneruj příklad ${index + 1}. Musí se lišit od typických učebnicových příkladů — zvol jiný kontext nebo číselné hodnoty.`
      }
    ];

    const raw = await Api.chat(messages, { maxTokens: 800, temperature: 0.95 });

    // AI může zabalit JSON do markdown bloku ```json...```
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const match   = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`AI nevrátila JSON (index ${index})`);

    const prob = JSON.parse(match[0]);

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
      tridy:    [6, 7, 8, 9],
      podtyp:   'generovany',
      zadani:   prob.zadani,
      kroky:    Array.isArray(prob.kroky)  ? prob.kroky  : [],
      odpoved:  prob.odpoved,
      jednotka: prob.jednotka || '',
      postup:   postupOvereny,
      kontrola: makeKontrola(prob),
      _meta:    { answerType: prob.answerType, answerValue: prob.answerValue, tolerance: prob.tolerance ?? 0.05, keywords: prob.keywords || [] },
    };
  }

  // Vygeneruje sadu count příkladů paralelně, s retry při selhání
  async function generujSadu(temaId, trida, count = 5, onProgress) {
    const promises = Array.from({ length: count }, async (_, i) => {
      try {
        const uloha = await generujUlohu(temaId, trida, i);
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
