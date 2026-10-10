// api.js — volání Claude přes Supabase Edge Function (klíč i volba modelu jsou na serveru)

const Api = (() => {

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
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return (data.text || '').trim();
  }

  // Vrací true pokud je dostupný nějaký způsob komunikace s AI
  function jeAiDostupne() {
    return Auth.jeAuthenticated();
  }

  return { chat, jeAiDostupne };
})();
