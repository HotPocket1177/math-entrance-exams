// engine.js — Sokratovský dialog engine s Claude (přes api.js) + statickým fallbackem
//
// Průběh úlohy:
//   1. faze 'zacatek' — žák volí první krok ze 3 možností („Jak začneš?“)
//   2. faze 'reseni'  — žák posílá mezikroky / výsledek, kouč reaguje (JSON odpověď
//      se zprávou, aktuálním krokem plánu a úryvky zadání ke zvýraznění)

// ── Obecné plány podle tématu (když AI není k dispozici) ──────
const OBECNY_PLAN = {
  slovni:    ['Pojmenuj neznámou', 'Sestav rovnici ze zadání', 'Vyřeš rovnici', 'Zkontroluj a odpověz'],
  procenta:  ['Urči základ (100 %)', 'Zjisti, kolik procent hledáš', 'Spočítej', 'Zkontroluj odpověď'],
  zlomky:    ['Převeď na společný tvar', 'Proveď operace ve správném pořadí', 'Zkrať na základní tvar'],
  rovnice:   ['Zbav se závorek a zlomků', 'Převeď neznámé na jednu stranu', 'Vyděl koeficientem', 'Udělej zkoušku'],
  geometrie: ['Vypiš si známé údaje', 'Vyber správný vzorec', 'Dosaď a spočítej', 'Zkontroluj jednotky'],
  grafy:     ['Najdi potřebná data', 'Urči, co počítáš', 'Spočítej', 'Zkontroluj odpověď']
};

// ── System prompt kouče ───────────────────────────────────────
function buildSystemPrompt(uloha, plan, kontextZaka) {
  const postup = (uloha.postup || [])
    .map((k, i) => `${i + 1}. ${k.popis ? k.popis + ' ' : ''}${k.latex || ''}`)
    .join('\n');
  const kroky = (uloha.kroky || []).map((k, i) => `${i + 1}. ${k}`).join('\n');

  let prompt = `Jsi trpělivý matematický kouč pro žáky 8.–9. třídy, kteří se připravují na přijímačky (CERMAT). Cíl: žák dojde k výsledku SÁM, ale nikdy ho nenecháš bezradného. Když neví, zmenšíš krok — neřekneš mu řešení.

Žák NEVIDÍ následující podklady. Slouží jen tobě, abys přesně poznal, kde žák je a co mu chybí:
ZADÁNÍ: ${uloha.zadani}
PLÁN ŘEŠENÍ:
${plan.map((p, i) => `${i + 1}. ${p}`).join('\n')}
VZOROVÝ POSTUP:
${postup || kroky || '(není k dispozici — spočítej si ho sám a pečlivě)'}
SPRÁVNÝ VÝSLEDEK: ${uloha.odpoved}

Jak reagovat:
- Žák posílá konečný výsledek, mezikrok (rovnici, mezivýsledek, úvahu), otázku nebo „nevím“.
- Správný mezikrok: konkrétně pochval, co udělal dobře, a posuň ho na další krok plánu.
- Chybný krok: řekni PŘESNĚ, kde je chyba (např. „podívej se na znaménko u 7“, „procenta počítáš z jiného základu“), ale nenapiš opravenou hodnotu. Polož jednu návodnou otázku.
- Žák neví: zeptej se na něco menšího a jednoduššího, co ho dovede k dalšímu kroku.
- NIKDY neprozraď výsledek ani číselné mezivýsledky, které má žák spočítat.
- Do pole "zvyraznit" dej 0–2 PŘESNÉ úryvky ze zadání (každý max 6 slov, zkopírované znak po znaku), na které se má žák teď podívat.
- Ve zprávě můžeš 1–2 klíčové pojmy zvýraznit **tučně**.
- Piš česky, tykej, povzbudivě a věcně, max 3 krátké věty. Matematiku piš v LaTeXu s dolary: $\\frac{1}{2}$, $x^2$. Nikdy nepoužívej \\(...\\) ani \\[...\\].
- Odpověď je JSON, takže každé zpětné lomítko v LaTeXu zdvoj: "$\\\\frac{1}{2}$".
- Drž se aktuálních požadavků CERMAT (aktualizace ${CERMAT_POZADAVKY.datum}): u soustavy rovnic nevyžaduj konkrétní metodu — uznej dosazovací, sčítací i jakýkoli jiný správný postup. Neuč pravidla pro odmocňování zlomku či součinu, rozklad podle vzorců $(a \\pm b)^2$, $a^2-b^2$ ani NSN/NSD tří čísel — když se to v řešení nabízí, veď žáka jednodušší cestou.

Úrovně nápovědy (když žák klikne na „Nevím, jak dál“):
1 = návodná otázka k aktuálnímu kroku;
2 = pojmenuj vztah nebo operaci, kterou má použít, a ukaž, na kterou část zadání se podívat;
3 = ukaž tvar dalšího kroku s prázdným místem (např. $2x + \\_\\_ = 63$), ale ne jeho výsledek.

Odpovídej VÝHRADNĚ validním JSON bez dalšího textu:
{"zprava": "text pro žáka", "krok": <číslo kroku plánu 1–${plan.length}, na kterém žák teď pracuje>, "pokrok": <true pokud žák správně udělal krok nebo se posunul, jinak false>, "zvyraznit": ["úryvek ze zadání"]}`;

  if (kontextZaka) {
    prompt += `\n\nKontext žáka: je v ${kontextZaka.trida}. třídě. Probraná témata: ${kontextZaka.odemcenaTemata.join(', ')}. Pokud úloha vyžaduje něco nad jeho ročník, přátelsky to zjednodušeně vysvětli.`;
  }
  return prompt;
}

// ── Prompt pro přípravu plánu a otázky „Jak začneš?“ ─────────
function buildPripravaPrompt(uloha) {
  const postup = (uloha.postup || []).map(k => `${k.popis ? k.popis + ' ' : ''}${k.latex || ''}`).join('\n');
  return `Připrav podklady k matematické úloze pro žáka 8.–9. třídy (přijímačky CERMAT).

ZADÁNÍ: ${uloha.zadani}
VZOROVÝ POSTUP:
${postup || (uloha.kroky || []).join('\n')}
VÝSLEDEK: ${uloha.odpoved}

1) "plan": 2–5 krátkých názvů kroků řešení (max 6 slov, BEZ čísel a výsledků), např. "Pojmenuj neznámou", "Sestav rovnici", "Vyřeš rovnici".
2) "zacatek": tři možnosti, jak úlohu ZAČÍT. Právě jedna je správná, dvě jsou věrohodné, ale špatné (typické chyby žáků — např. špatný základ procent, sečtení místo odečtení). Každá max 12 slov, bez výsledku. Ke každé "proc": jedna věta, proč to je / není dobrý začátek (bez prozrazení výsledku).

Matematiku piš v LaTeXu s dolary ($...$); je to JSON, takže zpětná lomítka zdvoj ("$\\\\frac{1}{2}$"). Vrať VÝHRADNĚ JSON:
{"plan": ["..."], "zacatek": [{"text": "...", "spravne": true, "proc": "..."}, {"text": "...", "spravne": false, "proc": "..."}, {"text": "...", "spravne": false, "proc": "..."}]}`;
}

// ── JSON helpery ──────────────────────────────────────────────
// Ověří a zamíchá možnosti „Jak začneš?“ — vrátí null, pokud nejsou použitelné
function normalizujZacatek(moznosti) {
  if (!Array.isArray(moznosti) || moznosti.length < 2 || moznosti.length > 4) return null;
  const ok = moznosti.every(m => m && typeof m.text === 'string' && m.text.trim());
  if (!ok || moznosti.filter(m => m.spravne === true).length !== 1) return null;
  const kopie = moznosti.map(m => ({ text: m.text.trim(), spravne: m.spravne === true, proc: (m.proc || '').trim() }));
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

function normalizujPlan(plan) {
  if (!Array.isArray(plan)) return null;
  const p = plan.filter(k => typeof k === 'string' && k.trim()).map(k => k.trim()).slice(0, 5);
  return p.length >= 2 ? p : null;
}

const Engine = (() => {
  const MAX_UROVEN_NAPOVEDY = 3;

  let stav = novyStav(null);

  function novyStav(uloha, temaId = null) {
    return {
      uloha,
      temaId,
      faze: 'reseni',          // 'zacatek' | 'reseni'
      plan: [],
      zacatek: null,           // [{ text, spravne, proc }] nebo null
      zacatekChyby: [],        // indexy špatně zvolených možností
      aktivniKrok: 1,          // 1-based index v plánu
      zvyraznit: [],           // úryvky zadání zvýrazněné koučem
      urovenNapovedy: 0,
      pocetNapoved: 0,
      krok: 0,                 // index pro statický fallback (kroky[])
      dokonceno: false,
      pocetPokusu: 0,          // jen pokusy bez pokroku — správné mezikroky se nepočítají
      limitPokusu: Math.floor(Math.random() * 6) + 5,  // 5–10
      zobrazenaOdpoved: false,
      messages: []             // konverzační historie pro AI
    };
  }

  // ── Inicializace nové úlohy (synchronní) ──────────────────────
  // kontextZaka: { trida, odemcenaTemata } nebo null
  function inicializuj(uloha, kontextZaka = null, temaId = null) {
    stav = novyStav(uloha, temaId);
    stav.plan = normalizujPlan(uloha.plan) || [];
    stav.zacatek = normalizujZacatek(uloha.zacatek);
    stav._kontext = kontextZaka;
    return { text: uloha.zadani };
  }

  function _obecnyPlan(temaId) {
    return OBECNY_PLAN[temaId] || ['Přečti si pozorně zadání', 'Urči, co hledáš', 'Spočítej', 'Zkontroluj odpověď'];
  }

  // ── Příprava plánu a otázky „Jak začneš?“ (async) ─────────────
  // Generované úlohy je mají z generátoru; statickým je doplní AI.
  // Vrátí { zacatek, plan, uvod?, error? } — uvod je první nápověda, když
  // „Jak začneš?“ není k dispozici.
  async function priprav() {
    const s = stav;  // během await může začít jiná úloha — pracuj se stavem té své
    let error = null;
    if ((!s.zacatek || !s.plan.length) && Api.jeAiDostupne()) {
      try {
        const raw = await Api.chat(
          [{ role: 'user', content: buildPripravaPrompt(s.uloha) }],
          { maxTokens: 4000, effort: 'low' }
        );
        const data = Api.parseJson(raw);
        if (!s.plan.length) s.plan = normalizujPlan(data?.plan) || [];
        if (!s.zacatek)     s.zacatek = normalizujZacatek(data?.zacatek);
      } catch (e) {
        error = e.message;
      }
    }
    if (!s.plan.length) s.plan = _obecnyPlan(s.temaId);
    s.messages = [{ role: 'system', content: buildSystemPrompt(s.uloha, s.plan, s._kontext) }];

    if (s.zacatek) {
      s.faze = 'zacatek';
      return { zacatek: s.zacatek, plan: s.plan, error };
    }
    s.faze = 'reseni';
    return { zacatek: null, plan: s.plan, uvod: s.uloha.kroky?.[0] || 'Co v zadání hledáš? Zkus to pojmenovat.', error };
  }

  // ── Volba prvního kroku ───────────────────────────────────────
  // Vrátí { spravne, proc, text, hotovo } — hotovo = přechod do fáze řešení
  function vyberZacatek(index) {
    const m = stav.zacatek?.[index];
    if (!m || stav.faze !== 'zacatek') return null;
    if (!m.spravne) {
      if (!stav.zacatekChyby.includes(index)) stav.zacatekChyby.push(index);
      return { spravne: false, proc: m.proc || 'Tohle tě k výsledku nedovede. Zkus jinou možnost.', text: m.text };
    }
    stav.faze = 'reseni';
    stav.aktivniKrok = 1;
    stav.messages.push({ role: 'user', content: `[Žák si jako první krok zvolil: „${m.text}“ — to je správně. Teď na tom pracuje.]` });
    const pobidka = 'Tak do toho — napiš, co ti vyšlo. Klidně jen první mezikrok.';
    const zprava = `${m.proc ? m.proc + ' ' : ''}${pobidka}`;
    stav.messages.push({ role: 'assistant', content: JSON.stringify({ zprava, krok: 1, pokrok: true, zvyraznit: [] }) });
    return { spravne: true, proc: m.proc, text: m.text, zprava, hotovo: true };
  }

  // ── Volání kouče (JSON odpověď) ───────────────────────────────
  async function _zeptejSeKouce(obsah) {
    stav.messages.push({ role: 'user', content: obsah });
    const raw  = await Api.chat(stav.messages, { maxTokens: 4000, effort: 'medium' });
    stav.messages.push({ role: 'assistant', content: raw });
    const data = Api.parseJson(raw);
    if (!data || typeof data.zprava !== 'string') {
      return { zprava: raw, pokrok: false };
    }
    const krok = parseInt(data.krok, 10);
    if (krok >= 1 && krok <= stav.plan.length) stav.aktivniKrok = Math.max(stav.aktivniKrok, krok);
    stav.zvyraznit = Array.isArray(data.zvyraznit)
      ? data.zvyraznit.filter(u => typeof u === 'string' && u.trim()).slice(0, 2)
      : [];
    return { zprava: data.zprava, pokrok: data.pokrok === true };
  }

  // ── Vyhodnocení odpovědi žáka (async) ─────────────────────────
  async function vyhodnotVstup(vstup) {
    if (!stav.uloha) return null;
    if (stav.dokonceno) return { typ: 'info', text: 'Úloha je již dokončena. Přejdi na další.' };

    vstup = vstup.trim();
    if (!vstup) return { typ: 'chyba', text: 'Napiš prosím svou odpověď.' };

    // Správnost vždy lokálně přes kontrola() — spolehlivější než AI
    if (stav.uloha.kontrola(vstup)) {
      stav.dokonceno  = true;
      stav.aktivniKrok = stav.plan.length + 1;
      stav.zvyraznit  = [];
      if (Api.jeAiDostupne()) {
        try {
          const { zprava } = await _zeptejSeKouce(`Žák napsal: ${vstup}\n[Toto je SPRÁVNÝ konečný výsledek. Krátce a konkrétně ho pochval — co se mu povedlo.]`);
          return { typ: 'uspech', text: zprava, hotovo: true };
        } catch {
          return { typ: 'uspech', text: `Výborně! Správná odpověď je: ${stav.uloha.odpoved}`, hotovo: true };
        }
      }
      return { typ: 'uspech', text: `Správně! ${stav.uloha.odpoved}`, hotovo: true };
    }

    if (Api.jeAiDostupne()) {
      try {
        const { zprava, pokrok } = await _zeptejSeKouce(`Žák napsal: ${vstup}`);
        if (pokrok) stav.urovenNapovedy = 0;
        else        stav.pocetPokusu++;
        if (_vycerpanePokusy()) return _ukazReseni();
        return { typ: 'napoveda', text: zprava, pokrok };
      } catch (e) {
        stav.pocetPokusu++;
        if (_vycerpanePokusy()) return _ukazReseni();
        return fallbackKrok(e.message);
      }
    }

    stav.pocetPokusu++;
    if (_vycerpanePokusy()) return _ukazReseni();
    return fallbackKrok(null);
  }

  // ── Tlačítko „Nevím, jak dál“ — stupňovaná nápověda ───────────
  // Nespotřebovává pokusy.
  async function napoveda() {
    if (!stav.uloha || stav.dokonceno || stav.faze !== 'reseni') return null;
    stav.urovenNapovedy = Math.min(MAX_UROVEN_NAPOVEDY, stav.urovenNapovedy + 1);
    stav.pocetNapoved++;

    if (Api.jeAiDostupne()) {
      try {
        const { zprava } = await _zeptejSeKouce(
          `[Žák klikl na „Nevím, jak dál“. Dej nápovědu úrovně ${stav.urovenNapovedy} k aktuálnímu kroku plánu (${stav.aktivniKrok}).]`
        );
        return { typ: 'napoveda', text: zprava, uroven: stav.urovenNapovedy };
      } catch (e) {
        return _statickaNapoveda(e.message);
      }
    }
    return _statickaNapoveda(null);
  }

  function _statickaNapoveda(errorMsg) {
    const kroky = stav.uloha.kroky || [];
    if (stav.krok + 1 < kroky.length) {
      stav.krok++;
      stav.aktivniKrok = Math.min(stav.plan.length, stav.aktivniKrok + 1);
      return { typ: 'napoveda', text: kroky[stav.krok], fallback: true, error: errorMsg };
    }
    return {
      typ: 'napoveda',
      text: 'Teď už máš všechno, co potřebuješ — zkus to dopočítat a napiš výsledek.',
      fallback: true,
      error: errorMsg
    };
  }

  function _vycerpanePokusy() {
    return stav.pocetPokusu >= stav.limitPokusu;
  }

  // Po limitPokusu neúspěšných pokusech zobraz řešení (zabrání softlocku)
  function _ukazReseni() {
    stav.zobrazenaOdpoved = true;
    stav.dokonceno = true;
    stav.zvyraznit = [];
    return {
      typ: 'reseni',
      text: `Nevadí, tady je správné řešení: ${stav.uloha.odpoved}`,
      hotovo: true,
      bodovaZtrata: true
    };
  }

  // ── Statický fallback (kroky[] z ulohy.js) ────────────────────
  function fallbackKrok(errorMsg) {
    const dalsiKrok = stav.krok + 1;
    if (dalsiKrok < (stav.uloha.kroky || []).length) {
      stav.krok = dalsiKrok;
      stav.aktivniKrok = Math.min(stav.plan.length, stav.aktivniKrok + 1);
      return {
        typ: 'napoveda',
        text: stav.uloha.kroky[dalsiKrok],
        fallback: true,
        error: errorMsg
      };
    }
    if (stav.dokonceno) return { typ: 'info', text: 'Tato úloha je vyřešena. Přejdi na další.', hotovo: true };
    // Kroky došly — řešení ukáže až _vycerpanePokusy(), ne hned první chyba
    const krokPlanu = stav.plan[stav.aktivniKrok - 1];
    return {
      typ: 'napoveda',
      text: krokPlanu
        ? `Zatím to nesedí. Vrať se ke kroku ${stav.aktivniKrok}: **${krokPlanu}** — a zkus to znovu.`
        : 'Zatím to nesedí. Projdi si postup znovu a zkus to ještě jednou.',
      fallback: true,
      error: errorMsg
    };
  }

  function getStav()      { return { ...stav }; }
  function jeDokonceno()  { return stav.dokonceno; }
  function aktualniKrok() { return stav.krok; }

  // ── Uložení / obnova stavu (pro persistenci konverzace) ──────
  function ulozStav() {
    return {
      messages:         stav.messages.slice(),
      temaId:           stav.temaId,
      faze:             stav.faze,
      plan:             stav.plan.slice(),
      zacatek:          stav.zacatek,
      zacatekChyby:     stav.zacatekChyby.slice(),
      aktivniKrok:      stav.aktivniKrok,
      zvyraznit:        stav.zvyraznit.slice(),
      urovenNapovedy:   stav.urovenNapovedy,
      pocetNapoved:     stav.pocetNapoved,
      krok:             stav.krok,
      pocetPokusu:      stav.pocetPokusu,
      limitPokusu:      stav.limitPokusu,
      zobrazenaOdpoved: stav.zobrazenaOdpoved,
      dokonceno:        stav.dokonceno
    };
  }

  // Obnoví engine do uloženého stavu — přeskočí inicializuj/priprav.
  // Volající musí předat ulohu (objekt úlohy) pro případný statický fallback.
  // Starší uložené stavy (bez faze/plan) se chovají jako fáze řešení.
  function obnovStav(savedStav, uloha) {
    const zaklad = novyStav(uloha, savedStav.temaId ?? null);
    stav = {
      ...zaklad,
      messages:         savedStav.messages         || [],
      faze:             savedStav.faze             || 'reseni',
      plan:             savedStav.plan?.length ? savedStav.plan : (normalizujPlan(uloha.plan) || []),
      zacatek:          savedStav.zacatek          || null,
      zacatekChyby:     savedStav.zacatekChyby     || [],
      aktivniKrok:      savedStav.aktivniKrok      ?? 1,
      zvyraznit:        savedStav.zvyraznit        || [],
      urovenNapovedy:   savedStav.urovenNapovedy   ?? 0,
      pocetNapoved:     savedStav.pocetNapoved     ?? 0,
      krok:             savedStav.krok             ?? 0,
      pocetPokusu:      savedStav.pocetPokusu      ?? 0,
      limitPokusu:      savedStav.limitPokusu      ?? zaklad.limitPokusu,
      zobrazenaOdpoved: savedStav.zobrazenaOdpoved ?? false,
      dokonceno:        savedStav.dokonceno        ?? false
    };
    if (!stav.plan.length) stav.plan = _obecnyPlan(stav.temaId);
  }

  return {
    inicializuj, priprav, vyberZacatek, vyhodnotVstup, napoveda,
    getStav, jeDokonceno, aktualniKrok, ulozStav, obnovStav
  };
})();
