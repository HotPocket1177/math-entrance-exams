// api.js — proxy na OpenAI přes Supabase Edge Function (s legacy fallbackem)

const Api = (() => {

  // Hlavní vstupní bod: pošle messages na AI a vrátí textovou odpověď
  // opts.maxTokens  — limit tokenů (výchozí 200, pro generování příkladů použij 800)
  // opts.temperature — teplota (výchozí 0.7)
  async function chat(messages, opts = {}) {
    const jwt = Auth.getJwt();
    const maxTokens  = opts.maxTokens  ?? 200;
    const temperature = opts.temperature ?? 0.7;

    // ── Primární cesta: Supabase Edge Function (JWT auth) ────────
    if (CONFIG.useEdgeFunction && jwt) {
      const res = await fetch(CONFIG.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
          'apikey': CONFIG.supabaseAnonKey
        },
        body: JSON.stringify({
          messages,
          model: CONFIG.model,
          max_tokens: maxTokens,
          temperature
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      return data.choices[0].message.content.trim();
    }

    // ── Fallback: přímé volání OpenAI (legacy, bez auth) ─────────
    const apiKey = localStorage.getItem(CONFIG.apiKeyStorageKey);
    if (!apiKey) {
      throw new Error('Chybí přihlášení ani API klíč. Přihlas se nebo zadej OpenAI klíč.');
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: CONFIG.model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
  }

  // Vrací true pokud je dostupný nějaký způsob komunikace s AI
  function jeAiDostupne() {
    return (CONFIG.useEdgeFunction && Auth.jeAuthenticated()) ||
           !!localStorage.getItem(CONFIG.apiKeyStorageKey);
  }

  return { chat, jeAiDostupne };
})();
