// auth.js — Supabase autentizace (přihlášení, registrace, session)

const Auth = (() => {
  let _supabase = null;
  let _session  = null;
  let _onSessionChange = null;  // callback registrovaný přes onSessionChange()

  // ── Inicializace ──────────────────────────────────────────────
  // Vrací Promise s aktuální session (null pokud nepřihlášen).
  // DŮLEŽITÉ: Auth.onSessionChange() volej PŘED Auth.init()
  function init() {
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

  // ── Odhlášení ─────────────────────────────────────────────────
  async function odhlas() {
    const { error } = await _supabase.auth.signOut();
    if (error) console.warn('Chyba při odhlašování:', error.message);
    _session = null;
  }

  // ── Profil žáka ───────────────────────────────────────────────
  async function getProfil() {
    if (!_session) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .select('trida')
      .eq('id', _session.user.id)
      .maybeSingle();
    if (error) {
      console.warn('Nepodařilo se načíst profil:', error.message);
      return null;
    }
    return data ?? null; // { trida: 8 } nebo null pokud profil neexistuje
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
    getProfil,
    getJwt,
    getSession,
    jeAuthenticated,
    getSupabase
  };
})();
