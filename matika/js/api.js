// api.js — proxy na OpenAI přes Supabase Edge Function (s legacy fallbackem)

const Api = (() => {

  // Hlavní vstupní bod: pošle messages na AI a vrátí textovou odpověď
  async function chat(messages) {
    const jwt = Auth.getJwt();

    // ── Primární cesta: Supabase Edge Function (JWT auth) ────────
    if (CONFIG.useEdgeFunction && jwt) {
      const res = await fetch(CONFIG.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          messages,
          model: CONFIG.model,
          max_tokens: 200,
          temperature: 0.7
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
        max_tokens: 200,
        temperature: 0.7
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
