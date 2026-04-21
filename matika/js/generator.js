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

Vygeneruj JEDEN nový, unikátní příklad. Požadavky:
- Realistický kontext (ne abstraktní "číslo x")
- Správná matematika, pěkná celá nebo desetinná čísla (ne nahodilá zlomky)
- Obtížnost odpovídající přijímačkám na střední školu
- Zadání a kroky v češtině, matematika v LaTeX ($...$)
- Kroky = sokratovské nápovědy, každý krok nasměruje žáka (ne rovnou řešení)

Vrať VÝHRADNĚ validní JSON (žádný text mimo JSON):
{
  "zadani": "text zadání (LaTeX v $...$)",
  "kroky": ["nápovědný krok 1", "krok 2", "krok 3"],
  "odpoved": "text správné odpovědi (krátce)",
  "postup": [
    {"latex": "výpočetní krok v LaTeX", "stav": "krok"},
    {"latex": "výsledek", "stav": "vysledek"}
  ],
  "answerType": "number",
  "answerValue": 42.5,
  "tolerance": 0.05
}

Pro slovní úlohy kde jsou dvě hodnoty (nebo soustava) použij "answerType": "keywords", "keywords": ["hodnota1", "hodnota2"].
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

    return {
      id:       `gen_${temaId}_${Date.now()}_${index}`,
      tridy:    [6, 7, 8, 9],
      podtyp:   'generovany',
      zadani:   prob.zadani,
      kroky:    Array.isArray(prob.kroky)  ? prob.kroky  : [],
      odpoved:  prob.odpoved,
      jednotka: prob.jednotka || '',
      postup:   Array.isArray(prob.postup) ? prob.postup : [],
      kontrola: makeKontrola(prob),
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

  return { generujSadu };
})();
