// daily.js — denní session progress (náhrada za seed-based daily systém)
//
// Každé téma lze procvičit max 3× za den. Po třetím dokončení se uzamkne
// do půlnoci (Europe/Prague). Při načtení aplikace se automaticky resetují
// záznamy s vypršeným datem.

const SessionProgress = (() => {

  const LOCAL_KEY = 'matika_daily_progress';

  function _nactiLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; }
  }

  function _ulozLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(_cache));
  }

  // In-memory cache — inicializuje se hned z localStorage, aby byl progress
  // viditelný okamžitě při startu (před dokončením async načtení z Supabase).
  let _cache = _nactiLocal();

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
    const toReset = [];  // expired → reset na 0
    const toHeal  = [];  // count>=3 bez data → doplň uzamceno_do

    (data || []).forEach(row => {
      if (row.uzamceno_do && row.uzamceno_do < dnes) {
        // Uzamčení vypršelo → reset
        toReset.push(row.tema_id);
        _cache[row.tema_id] = { dokonceni_count: 0, uzamceno_do: null };
      } else if (!row.uzamceno_do && (row.dokonceni_count || 0) >= 3) {
        // Léčení legacy dat: count=3 bez zámku → nastav datum na dnes
        // (jinak by se count 3 nikdy neresetoval při novém dni)
        toHeal.push(row.tema_id);
        _cache[row.tema_id] = { dokonceni_count: 3, uzamceno_do: dnes };
      } else {
        _cache[row.tema_id] = {
          dokonceni_count: row.dokonceni_count || 0,
          uzamceno_do:     row.uzamceno_do || null
        };
      }
    });

    // Synchronizuj do localStorage (záloha)
    _ulozLocal();
    console.log('[SessionProgress] načteno z DB:', JSON.stringify(_cache));

    // Resetuj expired záznamy v DB (fire-and-forget)
    toReset.forEach(temaId => {
      sb.from('session_progress')
        .upsert({ user_id: userId, tema_id: temaId, dokonceni_count: 0, uzamceno_do: null },
                { onConflict: 'user_id,tema_id' })
        .then(({ error: e }) => { if (e) console.warn('SessionProgress reset error:', e.message); });
    });

    // Doplň chybějící uzamceno_do pro count=3 záznamy (fire-and-forget)
    toHeal.forEach(temaId => {
      sb.from('session_progress')
        .upsert({ user_id: userId, tema_id: temaId, dokonceni_count: 3, uzamceno_do: dnes },
                { onConflict: 'user_id,tema_id' })
        .then(({ error: e }) => { if (e) console.warn('SessionProgress heal error:', e.message); });
    });
  }

  // ── Je téma dnes uzamčeno? ────────────────────────────────────
  function jeZamceno(temaId) {
    const d = _cache[temaId];
    if (!d) return false;
    // Explicitní zámek (uzamceno_do nastaveno)
    if (d.uzamceno_do && d.uzamceno_do >= getPragueDate()) return true;
    // Obranná pojistka: count >= 3 = všechny cykly dnes spotřebovány
    // (pokrývá případ kdy user zavřel prohlížeč před dokončením uzamkniSadu)
    if (d.dokonceni_count >= 3) return true;
    return false;
  }

  // ── Počet dokončení dnes ──────────────────────────────────────
  function getDokonceniCount(temaId) {
    return _cache[temaId]?.dokonceni_count || 0;
  }

  // ── Spuštění sady — zaregistruj cycle na začátku (ne na konci) ──
  // Tím se zabrání obcházení limitu přes tlačítko "Zpět" před dokončením.
  // Vrátí { count, zamceno }.
  // Pokud je téma již zamčeno nebo count >= 3 → zamceno: true, cyklus nespouštěj.
  async function spustiSadu(temaId, userId) {
    // Nejdřív zkontroluji základ z DB (kanonický zdroj)
    if (userId) {
      const sb = Auth.getSupabase();
      const { data: row } = await sb
        .from('session_progress')
        .select('dokonceni_count, uzamceno_do')
        .eq('user_id', userId)
        .eq('tema_id', temaId)
        .maybeSingle();

      if (row) {
        const dnes = getPragueDate();
        if (row.uzamceno_do && row.uzamceno_do >= dnes) {
          _cache[temaId] = { dokonceni_count: row.dokonceni_count, uzamceno_do: row.uzamceno_do };
          _ulozLocal();
          return { count: row.dokonceni_count, zamceno: true };
        }
        _cache[temaId] = {
          dokonceni_count: row.uzamceno_do && row.uzamceno_do < dnes ? 0 : (row.dokonceni_count || 0),
          uzamceno_do: row.uzamceno_do && row.uzamceno_do < dnes ? null : row.uzamceno_do
        };
      }
    }

    const currentCount = _cache[temaId]?.dokonceni_count || 0;

    if (currentCount >= 3 || jeZamceno(temaId)) {
      return { count: currentCount, zamceno: true };
    }

    const newCount = currentCount + 1;
    // Nastav uzamceno_do hned při 3. cyklu — zajistí správný next-day reset
    // i kdyby user zavřel prohlížeč před dokončením sady.
    const dnes = getPragueDate();
    const uzamcenoDo = newCount >= 3 ? dnes : null;
    _cache[temaId] = { ...(_cache[temaId] || {}), dokonceni_count: newCount, uzamceno_do: uzamcenoDo };
    _ulozLocal();

    // Zapiš do DB (fire-and-forget — neblokujeme UI)
    if (userId) {
      const sb = Auth.getSupabase();
      sb.from('session_progress')
        .upsert({ user_id: userId, tema_id: temaId, dokonceni_count: newCount, uzamceno_do: uzamcenoDo },
                { onConflict: 'user_id,tema_id' })
        .then(({ error: e }) => { if (e) console.warn('spustiSadu DB error:', e.message); });
    }

    return { count: newCount, zamceno: false };
  }

  // ── Uzamknutí tématu po dokončení 3. sady ────────────────────
  // Volá se POUZE po dokončení celé sady — nastaví uzamceno_do = dnes.
  async function uzamkniSadu(temaId, userId) {
    const dnes = getPragueDate();
    const count = _cache[temaId]?.dokonceni_count || 3;
    _cache[temaId] = { dokonceni_count: count, uzamceno_do: dnes };
    _ulozLocal();

    if (userId) {
      const sb = Auth.getSupabase();
      const { error } = await sb
        .from('session_progress')
        .upsert({ user_id: userId, tema_id: temaId, dokonceni_count: count, uzamceno_do: dnes },
                { onConflict: 'user_id,tema_id' });
      if (error) console.warn('uzamkniSadu DB error:', error.message);
    }
  }

  // ── Reset cache při odhlášení ─────────────────────────────────
  function resetCache() {
    _cache = {};
    localStorage.removeItem(LOCAL_KEY);
  }

  return { nactiVse, jeZamceno, getDokonceniCount, spustiSadu, uzamkniSadu, resetCache, getPragueDate };
})();
