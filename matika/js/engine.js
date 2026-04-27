// engine.js — Sokratovský dialog engine s OpenAI (přes api.js) + statickým fallbackem

// ── System prompt ─────────────────────────────────────────────
function buildSystemPrompt(kontextZaka) {
  const zaklad = `Jsi přísný, ale přátelský matematik-kouč, který pomáhá žákovi 8.–9. třídy připravit se na přijímací zkoušky. Vedeš sokratovský dialog — PŘÍSNĚ ZAKAZUJEŠ si říct výsledek nebo mezikrok přímo.
Pravidla:
- Vždy reaguj česky, stručně — POUZE jednou otázkou nebo krátkým pokynem (max 2 věty)
- NIKDY neuvádíš číselné mezivýsledky, vzorce ani kroky výpočtu — to musí žák napsat sám
- Nikdy neřekni přímo výsledek ani jeho část, dokud žák sám nedojde k správné odpovědi
- Pokud žák odpoví správně, pochval ho jednou větou a potvrď správnost
- Pokud žák odpoví špatně nebo neúplně, polož JEDNU konkrétní otázku která ho posune o krok dál — nikdy ne dvě otázky najednou
- Otázky musí být konkrétní k dané úloze, ne obecné ("Zkus to znovu" nestačí)
- První otázka u slovní úlohy musí být vždy: "Co v zadání nevíš? Zkus to pojmenovat — zapiš jako x."
- Pokud žák odpoví 3× špatně za sebou na stejný krok, smíš zmínit TYP operace (např. "Zkus použít rovnici"), ale stále bez čísel`;

  if (!kontextZaka) return zaklad;

  return zaklad + `\n\nKontext žáka: Je ve ${kontextZaka.trida}. třídě. Aktuální týden školního roku: ${kontextZaka.tydenvRoce}. Témata, která již probral: ${kontextZaka.odemcenaTemata.join(', ')}. Pokud úloha vyžaduje znalost, která je nad jeho ročník, upozorni ho přátelsky a zjednodušeně vysvětli potřebný koncept, než ho povedeš k řešení.`;
}

const Engine = (() => {
  // Stav aktuální úlohy
  let stav = {
    uloha: null,
    krok: 0,              // index pro statický fallback
    dokonceno: false,
    pocetPokusu: 0,
    limitPokusu: 4,       // náhodně 3 nebo 4 — nastaven v inicializuj()
    zobrazenaOdpoved: false,
    messages: []          // konverzační historie pro OpenAI
  };

  // ── Inicializace nové úlohy (synchronní) ──────────────────────
  // kontextZaka: { trida, tydenvRoce, odemcenaTemata } nebo null
  function inicializuj(uloha, kontextZaka = null) {
    stav = {
      uloha,
      krok: 0,
      dokonceno: false,
      pocetPokusu: 0,
      limitPokusu: Math.floor(Math.random() * 6) + 5,  // 5–10
      zobrazenaOdpoved: false,
      messages: [
        { role: 'system', content: buildSystemPrompt(kontextZaka) },
        { role: 'user',   content: `Zadání úlohy: ${uloha.zadani}` }
      ]
    };
    return { text: uloha.zadani };
  }

  // ── Úvodní sokratovská otázka (async) ─────────────────────────
  async function getUvodniOtazka() {
    if (!Api.jeAiDostupne()) {
      return { typ: 'hint', text: stav.uloha.kroky[0], fallback: true };
    }
    try {
      const text = await Api.chat(stav.messages);
      stav.messages.push({ role: 'assistant', content: text });
      return { typ: 'hint', text };
    } catch (e) {
      return { typ: 'hint', text: stav.uloha.kroky[0], fallback: true, error: e.message };
    }
  }

  // ── Vyhodnocení odpovědi žáka (async) ─────────────────────────
  async function vyhodnotVstup(vstup) {
    if (!stav.uloha) return null;
    if (stav.dokonceno) return { typ: 'info', text: 'Úloha je již dokončena. Přejdi na další.' };

    vstup = vstup.trim();
    if (!vstup) return { typ: 'chyba', text: 'Napiš prosím svou odpověď.' };

    stav.pocetPokusu++;

    // Správnost vždy lokálně přes kontrola() — spolehlivější než AI
    const spravne = stav.uloha.kontrola(vstup);

    if (spravne) {
      stav.dokonceno = true;
      if (Api.jeAiDostupne()) {
        try {
          stav.messages.push({ role: 'user', content: `Žák odpověděl správně: ${vstup}` });
          const pochvala = await Api.chat(stav.messages);
          stav.messages.push({ role: 'assistant', content: pochvala });
          return { typ: 'uspech', text: pochvala, hotovo: true };
        } catch {
          // Fallback pochvala pokud API selže
          return { typ: 'uspech', text: `Výborně! Správná odpověď je: ${stav.uloha.odpoved}`, hotovo: true };
        }
      }
      return { typ: 'uspech', text: `Správně! ${stav.uloha.odpoved}`, hotovo: true };
    }

    // Po limitPokusu neúspěšných pokusech zobraz řešení (zabrání softlocku)
    if (stav.pocetPokusu >= stav.limitPokusu) {
      stav.zobrazenaOdpoved = true;
      stav.dokonceno = true;
      return {
        typ: 'reseni',
        text: `Nevadí, tady je správné řešení: ${stav.uloha.odpoved}`,
        hotovo: true,
        bodovaZtrata: true
      };
    }

    // Špatná odpověď → AI nápověda nebo statický fallback
    if (Api.jeAiDostupne()) {
      try {
        stav.messages.push({ role: 'user', content: vstup });
        const napoveda = await Api.chat(stav.messages);
        stav.messages.push({ role: 'assistant', content: napoveda });
        return { typ: 'napoveda', text: napoveda };
      } catch (e) {
        return fallbackKrok(e.message);
      }
    }

    return fallbackKrok(null);
  }

  // ── Statický fallback (kroky[] z ulohy.js) ────────────────────
  function fallbackKrok(errorMsg) {
    const dalsiKrok = stav.krok + 1;
    if (dalsiKrok < stav.uloha.kroky.length) {
      stav.krok = dalsiKrok;
      return {
        typ: 'napoveda',
        text: stav.uloha.kroky[dalsiKrok],
        fallback: true,
        error: errorMsg
      };
    }
    if (!stav.zobrazenaOdpoved) {
      stav.zobrazenaOdpoved = true;
      stav.dokonceno = true;
      return {
        typ: 'reseni',
        text: `Nevadí, tady je správné řešení: ${stav.uloha.odpoved}`,
        hotovo: true,
        bodovaZtrata: true
      };
    }
    return { typ: 'info', text: 'Tato úloha je vyřešena. Přejdi na další.', hotovo: true };
  }

  function getStav()      { return { ...stav }; }
  function jeDokonceno()  { return stav.dokonceno; }
  function aktualniKrok() { return stav.krok; }

  // ── Uložení / obnova stavu (pro persistenci konverzace) ──────
  function ulozStav() {
    return {
      messages:         stav.messages.slice(),
      krok:             stav.krok,
      pocetPokusu:      stav.pocetPokusu,
      limitPokusu:      stav.limitPokusu,
      zobrazenaOdpoved: stav.zobrazenaOdpoved,
      dokonceno:        stav.dokonceno
    };
  }

  // Obnoví engine do uloženého stavu — přeskočí inicializuj/getUvodniOtazka.
  // Volající musí předat ulohu (objekt úlohy) pro případný statický fallback.
  function obnovStav(savedStav, uloha) {
    stav = {
      uloha,
      messages:         savedStav.messages         || [],
      krok:             savedStav.krok             ?? 0,
      pocetPokusu:      savedStav.pocetPokusu      ?? 0,
      limitPokusu:      savedStav.limitPokusu      ?? (Math.floor(Math.random() * 6) + 5),
      zobrazenaOdpoved: savedStav.zobrazenaOdpoved ?? false,
      dokonceno:        savedStav.dokonceno        ?? false
    };
  }

  return { inicializuj, getUvodniOtazka, vyhodnotVstup, getStav, jeDokonceno, aktualniKrok, ulozStav, obnovStav };
})();
