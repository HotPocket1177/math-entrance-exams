// daily.js — denní session progress (náhrada za seed-based daily systém)
//
// Každé téma lze procvičit max 3× za den. Po třetím dokončení se uzamkne
// do půlnoci (Europe/Prague). Při načtení aplikace se automaticky resetují
// záznamy s vypršeným datem.

const SessionProgress = (() => {

  // In-memory cache: temaId → { dokonceni_count, uzamceno_do }
  let _cache = {};

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

    if (error) { console.warn('SessionProgress load error:', error.message); return; }

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
  // count  = nový celkový počet dokončení dnes
  // zamceno = true pokud count dosáhl 3 (téma se uzamče)
  async function dokoncSadu(temaId, userId) {
    const dnes    = getPragueDate();
    const current = _cache[temaId] || { dokonceni_count: 0, uzamceno_do: null };
    const newCount = current.dokonceni_count + 1;
    const zamceno  = newCount >= 3;
    const newZamcenoDo = zamceno ? dnes : null;

    // Aktualizuj cache okamžitě
    _cache[temaId] = { dokonceni_count: newCount, uzamceno_do: newZamcenoDo };

    // Sync do Supabase (fire-and-forget)
    if (userId) {
      Auth.getSupabase()
        .from('session_progress')
        .upsert({
          user_id:         userId,
          tema_id:         temaId,
          dokonceni_count: newCount,
          uzamceno_do:     newZamcenoDo
        })
        .then(({ error }) => { if (error) console.warn('SessionProgress sync error:', error.message); });
    }

    return { count: newCount, zamceno };
  }

  // ── Reset cache při odhlášení ─────────────────────────────────
  function resetCache() {
    _cache = {};
  }

  return { nactiVse, jeZamceno, getDokonceniCount, dokoncSadu, resetCache, getPragueDate };
})();
