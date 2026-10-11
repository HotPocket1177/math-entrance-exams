// auth.js — Supabase autentizace (přihlášení, registrace, session)

const Auth = (() => {
  let _supabase = null;
  let _session  = null;
  let _onSessionChange = null;  // callback registrovaný přes onSessionChange()

  // ── Inicializace ──────────────────────────────────────────────
  // Vrací Promise s aktuální session (null pokud nepřihlášen).
  // DŮLEŽITÉ: Auth.onSessionChange() volej PŘED Auth.init()
  function init() {
    obnovDocasnouSession();
    _supabase = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

    _supabase.auth.onAuthStateChange((event, session) => {
      _session = session;
      if (_onSessionChange) _onSessionChange(event, session);
    });

    return _supabase.auth.getSession().then(({ data }) => {
      _session = data.session;
      return _session;
    });
  }

  // ── „Nezůstat přihlášen“ ─────────────────────────────────────
  // Supabase drží token v localStorage. Při opuštění stránky ho přesuneme do
  // sessionStorage: obnovení stránky (F5) ho vrátí zpět, zavření tabu ho zahodí.
  // (Dřív se token jen mazal — a odhlásilo to i obyčejné F5.)
  const NEZAPAMATOVAT_KEY = 'matika_nezapamatovat';
  const DOCASNA_KEY       = 'matika_docasna_session';

  function _prestehujTokenDoSession() {
    const tokeny = {};
    Object.keys(localStorage)
      .filter(k => k.endsWith('-auth-token'))
      .forEach(k => { tokeny[k] = localStorage.getItem(k); localStorage.removeItem(k); });
    if (Object.keys(tokeny).length) sessionStorage.setItem(DOCASNA_KEY, JSON.stringify(tokeny));
  }

  function nezapamatovatPrihlaseni() {
    sessionStorage.setItem(NEZAPAMATOVAT_KEY, '1');
    window.addEventListener('pagehide', _prestehujTokenDoSession);
  }

  function obnovDocasnouSession() {
    if (sessionStorage.getItem(NEZAPAMATOVAT_KEY) !== '1') return;
    try {
      const tokeny = JSON.parse(sessionStorage.getItem(DOCASNA_KEY) || '{}');
      Object.entries(tokeny).forEach(([k, v]) => localStorage.setItem(k, v));
    } catch {}
    sessionStorage.removeItem(DOCASNA_KEY);
    window.addEventListener('pagehide', _prestehujTokenDoSession);
  }

  // Zaregistruj callback volaný při změně auth stavu (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED…)
  function onSessionChange(cb) {
    _onSessionChange = cb;
  }

  // ── Registrace ────────────────────────────────────────────────
  async function registruj(email, password) {
    const { data, error } = await _supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Vytvoř profil ihned po registraci s výchozí třídou 8
    if (data.user) {
      const { error: profError } = await _supabase
        .from('profiles')
        .upsert({ id: data.user.id, trida: 8 });
      if (profError) console.warn('Nepodařilo se uložit profil:', profError.message);
    }
    return data;
  }

  // ── Přihlášení ────────────────────────────────────────────────
  // Session je vždy trvalá (localStorage). Pro "nezůstat přihlášen" volající
  // zaregistruje beforeunload handler, který tokeny smaže při zavření tabu.
  async function prihlasuj(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // ── Zapomenuté heslo ──────────────────────────────────────────
  // Pošle e-mail s odkazem zpět do aplikace; po kliknutí přijde událost
  // PASSWORD_RECOVERY a app.js nabídne nastavení nového hesla.
  async function posliObnovuHesla(email) {
    const { error } = await _supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });
    if (error) throw error;
  }

  async function zmenHeslo(heslo) {
    const { error } = await _supabase.auth.updateUser({ password: heslo });
    if (error) throw error;
  }

  // ── Nahlášení chyby v úloze ───────────────────────────────────
  async function nahlasChybu(zaznam) {
    if (!_session) throw new Error('Pro nahlášení se musíš přihlásit.');
    const { error } = await _supabase
      .from('nahlasene_chyby')
      .insert({ ...zaznam, user_id: _session.user.id });
    if (error) throw error;
  }

  // ── Odhlášení ─────────────────────────────────────────────────
  async function odhlas() {
    sessionStorage.removeItem(NEZAPAMATOVAT_KEY);
    sessionStorage.removeItem(DOCASNA_KEY);
    window.removeEventListener('pagehide', _prestehujTokenDoSession);
    const { error } = await _supabase.auth.signOut();
    if (error) console.warn('Chyba při odhlašování:', error.message);
    _session = null;
  }

  // ── Profil žáka ───────────────────────────────────────────────
  async function getProfil() {
    if (!_session) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .select('trida, last_seen_version, email_updates, onboarding_done, sady_celkem')
      .eq('id', _session.user.id)
      .maybeSingle();
    if (error) {
      console.warn('Nepodařilo se načíst profil:', error.message);
      return null;
    }
    return data ?? null;
  }

  // ── Novinky: zaznamenej že uživatel viděl aktuální verzi ─────
  async function ulozVerziZobrazeni(verze) {
    if (!_session) return;
    await _supabase
      .from('profiles')
      .update({ last_seen_version: verze })
      .eq('id', _session.user.id);
  }

  // ── E-mail preference (opt-in / opt-out) ─────────────────────
  async function ulozEmailPreferenci(hodnota) {
    if (!_session) return;
    const { error } = await _supabase
      .from('profiles')
      .update({ email_updates: hodnota })
      .eq('id', _session.user.id);
    if (error) console.warn('Chyba uložení email preference:', error.message);
  }

  // ── Sady celkem: inkrement na DB straně (atomic, bez race condition) ──
  async function incrementSadyCelkem() {
    if (!_session) return;
    await _supabase.rpc('increment_sady_celkem', { uid: _session.user.id });
  }

  // ── Onboarding: označ jako dokončený ─────────────────────────
  async function ulozOnboardingDone() {
    if (!_session) return;
    await _supabase
      .from('profiles')
      .update({ onboarding_done: true })
      .eq('id', _session.user.id);
  }

  // ── Gettery ───────────────────────────────────────────────────
  function getJwt()          { return _session?.access_token ?? null; }
  function getSession()      { return _session; }
  function jeAuthenticated() { return !!_session; }
  function getSupabase()     { return _supabase; }

  return {
    init,
    onSessionChange,
    registruj,
    prihlasuj,
    odhlas,
    nezapamatovatPrihlaseni,
    posliObnovuHesla,
    zmenHeslo,
    nahlasChybu,
    getProfil,
    ulozVerziZobrazeni,
    ulozEmailPreferenci,
    ulozOnboardingDone,
    incrementSadyCelkem,
    getJwt,
    getSession,
    jeAuthenticated,
    getSupabase
  };
})();
