// daily.js — denní session progress (náhrada za seed-based daily systém)
//
// Každé téma lze procvičit max 3× za den. Po třetím dokončení se uzamkne
// do půlnoci (Europe/Prague). Při načtení aplikace se automaticky resetují
// záznamy s vypršeným datem.

const SessionProgress = (() => {

  // In-memory cache: temaId → { dokonceni_count, uzamceno_do }
  let _cache = {};

  const LOCAL_KEY = 'matika_daily_progress';

  function _nactiLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; }
  }

  function _ulozLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(_cache));
  }

  // ── Pomocné: dnešní datum v Prague timezone ───────────────────
  // Vrátí "2026-04-15" — ISO datum v pražské časové zóně.
  function getPragueDate() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
  }

  // ── Načti vše z Supabase po přihlášení ───────────────────────
  // Volej jednou po úspěšném přihlášení. Resetuje záznamy s vypršeným
  // uzamčením přímo v DB (fire-and-forget).
  async function nactiVse(userId) {
    if (!userId) return;
    const sb   = Auth.getSupabase();
    const dnes = getPragueDate();

    const { data, error } = await sb
      .from('session_progress')
      .select('tema_id, dokonceni_count, uzamceno_do')
      .eq('user_id', userId);

    if (error) {
      console.warn('SessionProgress load error:', error.message);
      // Záložní plán: použij localStorage data
      const local = _nactiLocal();
      if (Object.keys(local).length > 0) _cache = local;
      return;
    }

    _cache = {};
    const toReset = [];

    (data || []).forEach(row => {
      if (row.uzamceno_do && row.uzamceno_do < dnes) {
        // Uzamčení vypršelo → reset
        toReset.push(row.tema_id);
        _cache[row.tema_id] = { dokonceni_count: 0, uzamceno_do: null };
      } else {
        _cache[row.tema_id] = {
          dokonceni_count: row.dokonceni_count || 0,
          uzamceno_do:     row.uzamceno_do || null
        };
      }
    });

    // Synchronizuj do localStorage (záloha)
    _ulozLocal();

    // Resetuj expired záznamy v DB (fire-and-forget)
    toReset.forEach(temaId => {
      sb.from('session_progress')
        .upsert({ user_id: userId, tema_id: temaId, dokonceni_count: 0, uzamceno_do: null })
        .then(({ error: e }) => { if (e) console.warn('SessionProgress reset error:', e.message); });
    });
  }

  // ── Je téma dnes uzamčeno? ────────────────────────────────────
  function jeZamceno(temaId) {
    const d = _cache[temaId];
    if (!d?.uzamceno_do) return false;
    return d.uzamceno_do >= getPragueDate();
  }

  // ── Počet dokončení dnes ──────────────────────────────────────
  function getDokonceniCount(temaId) {
    return _cache[temaId]?.dokonceni_count || 0;
  }

  // ── Zaznamenej dokončení sady ─────────────────────────────────
  // Vrátí { count: int, zamceno: bool }
  // count  = nový celkový počet dokončení dnes (načteno z DB nebo z cache)
  // zamceno = true pokud count dosáhl 3 (téma se uzamče)
  //
  // Přístup: čti aktuální count z Supabase (nebo z cache pokud userId chybí),
  // přičti 1, zapiš zpět. await zaručuje spolehlivost i po reloadu stránky.
  async function dokoncSadu(temaId, userId) {
    const dnes = getPragueDate();
    let currentCount = _cache[temaId]?.dokonceni_count || 0;

    if (userId) {
      const sb = Auth.getSupabase();

      // Krok 1 — přečti aktuální count z DB (kanonický zdroj)
      const { data: row, error: readErr } = await sb
        .from('session_progress')
        .select('dokonceni_count')
        .eq('user_id', userId)
        .eq('tema_id', temaId)
        .maybeSingle();

      if (readErr) {
        console.warn('SessionProgress read error:', readErr.message);
      } else if (row !== null) {
        currentCount = row.dokonceni_count || 0;
      }

      const newCount     = currentCount + 1;
      const zamceno      = newCount >= 3;
      const newZamcenoDo = zamceno ? dnes : null;

      // Aktualizuj cache
      _cache[temaId] = { dokonceni_count: newCount, uzamceno_do: newZamcenoDo };

      // Krok 2 — zapiš zpět do DB (await — ne fire-and-forget)
      const { error: writeErr } = await sb
        .from('session_progress')
        .upsert({
          user_id:         userId,
          tema_id:         temaId,
          dokonceni_count: newCount,
          uzamceno_do:     newZamcenoDo
        }, { onConflict: 'user_id,tema_id' });

      if (writeErr) console.warn('SessionProgress upsert error:', writeErr.message);

      _ulozLocal();
      return { count: newCount, zamceno };
    }

    // Nepřihlášený uživatel — pouze lokální cache, bez limitu
    const newCount = currentCount + 1;
    _cache[temaId] = { dokonceni_count: newCount, uzamceno_do: null };
    return { count: newCount, zamceno: false };
  }

  // ── Reset cache při odhlášení ─────────────────────────────────
  function resetCache() {
    _cache = {};
  }

  return { nactiVse, jeZamceno, getDokonceniCount, dokoncSadu, resetCache, getPragueDate };
})();
