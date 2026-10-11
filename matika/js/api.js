// api.js — volání Claude přes Supabase Edge Function (klíč i volba modelu jsou na serveru)

const Api = (() => {

  // Den (YYYY-MM-DD), kdy server ohlásil vyčerpaný denní limit — do konce
  // toho dne už AI nevoláme a aplikace jede na statických úlohách a nápovědách
  let _limitDen = null;
  const dnes = () => new Date().toLocaleDateString('sv-SE');

  // Hlavní vstupní bod: pošle messages na AI a vrátí textovou odpověď
  // opts.maxTokens — strop výstupu včetně přemýšlení modelu (výchozí 4000)
  // opts.effort    — 'low' | 'medium' | 'high' (výchozí 'medium')
  async function chat(messages, opts = {}) {
    const jwt = Auth.getJwt();
    if (!jwt) throw new Error('Pro AI kouče se musíš přihlásit.');

    const res = await fetch(CONFIG.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'apikey': CONFIG.supabaseAnonKey
      },
      body: JSON.stringify({
        messages,
        max_tokens: opts.maxTokens ?? 4000,
        effort:     opts.effort    ?? 'medium'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.error?.code === 'denni_limit') _limitDen = dnes();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return (data.text || '').trim();
  }

  // Vytáhne JSON objekt z odpovědi AI (i když je zabalený v ```json … ```).
  // Model často píše LaTeX s jedním zpětným lomítkem ($\frac{1}{2}$) — v JSON je
  // ale \f, \t, \n, \r, \b escape sekvence, takže by se z \frac stalo „form feed + rac“
  // a \, nebo \{ by parsování úplně shodily. Proto lomítka před LaTeXem zdvojíme.
  function parseJson(raw) {
    const s = (raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(opravLatexEscapy(m[0])); } catch { return null; }
  }

  function opravLatexEscapy(json) {
    return json.replace(/\\([\s\S])/g, (cele, znak, pozice) => {
      if (znak === '\\' || znak === '"' || znak === '/') return cele;   // platný escape
      const dalsi = json.slice(pozice + 2);
      if (znak === 'u' && /^[0-9a-fA-F]{4}/.test(dalsi)) return cele;   // á
      if (/[a-zA-Z]/.test(znak)) {
        const prikaz = /^[a-zA-Z]*/.exec(dalsi)[0];
        // Jedno písmeno (\n, \t…) nebo nový řádek před slovem s velkým písmenem = skutečný escape
        const jeEscape = 'bfnrt'.includes(znak) && (prikaz === '' || ('nrt'.includes(znak) && /^[A-ZÁ-Ž]/.test(dalsi)));
        if (jeEscape) return cele;
      }
      return '\\\\' + znak;   // LaTeX příkaz nebo \, \{ \% … → doslovné lomítko
    });
  }

  function jeLimitVycerpan() {
    return _limitDen === dnes();
  }

  // Vrací true pokud je dostupný nějaký způsob komunikace s AI
  function jeAiDostupne() {
    return Auth.jeAuthenticated() && !jeLimitVycerpan();
  }

  return { chat, parseJson, jeAiDostupne, jeLimitVycerpan };
})();
