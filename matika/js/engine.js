// engine.js — Sokratovský dialog engine s OpenAI API + statickým fallbackem

const SYSTEM_PROMPT = `Jsi přátelský matematik, který pomáhá žákovi 8.–9. třídy připravit se na přijímací zkoušky. Vedeš sokratovský dialog — NIKDY nedáváš rovnou správnou odpověď. Místo toho kladeš návodné otázky, které žáka dovedou k řešení vlastním myšlením.
Pravidla:
- Vždy reaguj česky, přátelsky, stručně (2–4 věty max)
- Nikdy neřekni přímo výsledek, dokud žák sám nedojde k správné odpovědi
- Pokud žák odpoví správně, pochval ho a potvrď správnost
- Pokud žák odpoví špatně nebo neúplně, nasměruj ho otázkou
- První otázka u slovní úlohy musí být vždy: "Co v zadání nevíš? Zkus to pojmenovat — zapiš jako x."
- Pokud žák odpoví 3× špatně za sebou, dej konkrétnější nápovědu, ale stále ne celé řešení`;

const Engine = (() => {
  let stav = {
    uloha: null,
    krok: 0,             // index pro statický fallback
    dokonceno: false,
    pocetPokusu: 0,
    zobrazenaOdpoved: false,
    messages: []         // konverzační historie pro OpenAI
  };

  // ── Inicializace nové úlohy (synchronní) ──────────────────────
  function inicializuj(uloha) {
    stav = {
      uloha: uloha,
      krok: 0,
      dokonceno: false,
      pocetPokusu: 0,
      zobrazenaOdpoved: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Zadání úlohy: ${uloha.zadani}` }
      ]
    };
    return { text: uloha.zadani };
  }

  // ── Získání úvodní sokratovské otázky (async) ─────────────────
  async function getUvodniOtazka() {
    const apiKey = localStorage.getItem(CONFIG.apiKeyStorageKey);
    if (!apiKey) {
      return { typ: 'hint', text: stav.uloha.kroky[0], fallback: true };
    }
    try {
      const text = await volajApi(stav.messages);
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

    // Správnost vždy lokálně přes kontrola()
    const spravne = stav.uloha.kontrola(vstup);
    const apiKey  = localStorage.getItem(CONFIG.apiKeyStorageKey);

    if (spravne) {
      stav.dokonceno = true;
      if (apiKey) {
        try {
          stav.messages.push({ role: 'user', content: `Žák odpověděl správně: ${vstup}` });
          const pochvala = await volajApi(stav.messages);
          stav.messages.push({ role: 'assistant', content: pochvala });
          return { typ: 'uspech', text: pochvala, hotovo: true };
        } catch (e) {
          // Fallback pochvala
          return { typ: 'uspech', text: `Výborně! Správná odpověď je: ${stav.uloha.odpoved}`, hotovo: true };
        }
      }
      return { typ: 'uspech', text: `Správně! ${stav.uloha.odpoved}`, hotovo: true };
    }

    // Špatná odpověď → AI nápověda nebo statický fallback
    if (apiKey) {
      try {
        stav.messages.push({ role: 'user', content: vstup });
        const napoveda = await volajApi(stav.messages);
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

  // ── Volání OpenAI API ─────────────────────────────────────────
  async function volajApi(messages) {
    const apiKey = localStorage.getItem(CONFIG.apiKeyStorageKey);
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: CONFIG.model,
        messages,
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  function getStav()      { return { ...stav }; }
  function jeDokonceno()  { return stav.dokonceno; }
  function aktualniKrok() { return stav.krok; }

  return { inicializuj, getUvodniOtazka, vyhodnotVstup, getStav, jeDokonceno, aktualniKrok };
})();
