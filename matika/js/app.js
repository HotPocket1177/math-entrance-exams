// app.js — routing mezi obrazovkami, UI logika, auth gate

const App = (() => {
  // ─── Stav aplikace ───────────────────────────────────────────
  let aktualniTema       = null;
  let aktualniUlohaIndex = 0;
  let skore              = { spravne: 0, celkem: 0 };
  let dialogLog          = [];
  let cekaNaApi          = false;
  let postupIndex        = -1;  // index posledního odhaleného kroku z postup[]

  // Stav žáka (vyplní se po přihlášení)
  let profil           = null;   // { trida: 8 }
  let tydenvRoce       = null;
  let odemcenaTemata   = null;   // string[] nebo null (= vše odemčeno)
  let jeDenniRezim     = false;

  // ─── Správa obrazovek ─────────────────────────────────────────
  const SCREENS = ['screen-auth', 'screen-home', 'screen-apikey', 'screen-uloha', 'screen-vysledky'];

  function zobrazScreen(id) {
    SCREENS.forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  }

  function zobrazDomovskou()  { zobrazScreen('screen-home');    renderTemata(); }
  function zobrazUlohu()      { zobrazScreen('screen-uloha'); }
  function zobrazVysledky()   { zobrazScreen('screen-vysledky'); renderVysledky(); }
  function zobrazAuthScreen() { zobrazScreen('screen-auth'); }

  function zobrazApiKlic(callbackPoCancelaci) {
    zobrazScreen('screen-apikey');
    document.getElementById('apikey-input').value =
      localStorage.getItem(CONFIG.apiKeyStorageKey) || '';
    document.getElementById('apikey-input').focus();
    const btnZpet = document.getElementById('btn-apikey-zpet');
    if (callbackPoCancelaci) {
      btnZpet.classList.remove('hidden');
      btnZpet.onclick = callbackPoCancelaci;
    } else {
      btnZpet.classList.add('hidden');
    }
  }

  // ─── Po úspěšném přihlášení ───────────────────────────────────
  async function pokracujPoLoginu(session) {
    profil         = await Auth.getProfil();
    odemcenaTemata = Syllabus.getOdemcenaTemataPoTridu(profil?.trida || 8);

    // Hlavička — zobraz avatar dropdown
    const email = session?.user?.email || Auth.getSession()?.user?.email || '';
    document.getElementById('avatar-inicialy').textContent = email.charAt(0).toUpperCase() || '?';
    document.getElementById('dropdown-email').textContent  = email;
    document.getElementById('user-dropdown-wrap').classList.remove('hidden');
    renderDropdownTridy();

    zobrazDomovskou();
  }

  // ─── Dropdown: výběr třídy ────────────────────────────────────
  function renderDropdownTridy() {
    const wrap = document.getElementById('dropdown-tridy');
    wrap.innerHTML = '';
    const aktualniTrida = profil?.trida || 8;
    [6, 7, 8, 9].forEach(t => {
      const item = document.createElement('div');
      item.className = `dropdown-trida-item${t === aktualniTrida ? ' aktivni' : ''}`;
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', t === aktualniTrida ? 'true' : 'false');
      item.innerHTML = `<span>${t}. třída</span>${t === aktualniTrida ? '<span aria-hidden="true">✓</span>' : ''}`;
      item.addEventListener('click', () => zmenTridu(t));
      wrap.appendChild(item);
    });
  }

  async function zmenTridu(novaTrida) {
    if (!Auth.jeAuthenticated() || novaTrida === profil?.trida) {
      zavriDropdown(); return;
    }
    const { error } = await Auth.getSupabase()
      .from('profiles')
      .update({ trida: novaTrida })
      .eq('id', Auth.getSession().user.id);
    if (error) { console.warn('Chyba update třídy:', error.message); return; }

    profil         = { ...profil, trida: novaTrida };
    odemcenaTemata = Syllabus.getOdemcenaTemataPoTridu(novaTrida);
    renderDropdownTridy();
    zavriDropdown();
    renderTemata();
  }

  function zavriDropdown() {
    document.getElementById('user-dropdown').classList.add('hidden');
    document.getElementById('btn-user-avatar').setAttribute('aria-expanded', 'false');
  }

  // ─── localStorage helpers ────────────────────────────────────
  function nactiProgress() {
    try { return JSON.parse(localStorage.getItem('matika_progress') || '{}'); }
    catch { return {}; }
  }

  function ulozProgress(temaId, ulohaId, uspech) {
    // Lokální cache
    const p = nactiProgress();
    if (!p[temaId]) p[temaId] = {};
    p[temaId][ulohaId] = uspech ? 'spravne' : (p[temaId][ulohaId] || 'pokus');
    localStorage.setItem('matika_progress', JSON.stringify(p));

    // Supabase sync (fire-and-forget, neblokuje UI)
    if (Auth.jeAuthenticated()) {
      Auth.getSupabase()
        .from('progress')
        .upsert({
          user_id:    Auth.getSession().user.id,
          tema_id:    temaId,
          uloha_id:   ulohaId,
          uspech:     uspech,
          updated_at: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) console.warn('Progress sync selhal:', error.message);
        });
    }
  }

  function pocetDokoncenychUloh(temaId) {
    const p = nactiProgress();
    if (!p[temaId]) return 0;
    return Object.values(p[temaId]).filter(v => v === 'spravne').length;
  }

  function maApiKlic() {
    return !!localStorage.getItem(CONFIG.apiKeyStorageKey);
  }

  // ─── Domovská obrazovka ───────────────────────────────────────
  function renderTemata() {
    // AI status badge
    const aiStav = document.getElementById('ai-stav');
    if (aiStav) {
      const aiOn = Auth.jeAuthenticated() || maApiKlic();
      aiStav.textContent = aiOn ? '🤖 AI mód aktivní' : '📖 Statický mód';
      aiStav.className   = aiOn ? 'ai-stav ai-on' : 'ai-stav ai-off';
    }

    const grid = document.getElementById('temata-grid');
    grid.innerHTML = '';

    TEMATA.forEach(tema => {
      const trida         = profil?.trida || 8;
      const ulohyProTridu = Syllabus.getUlohyProTridu(tema.id, trida);
      const jeOdemceno    = ulohyProTridu.length > 0;
      const celkem        = ulohyProTridu.length;
      const hotovo        = pocetDokoncenychUloh(tema.id);
      const procent       = celkem > 0 ? Math.round((hotovo / celkem) * 100) : 0;
      const minTrida      = !jeOdemceno ? Syllabus.getMinTrida(tema.id) : null;

      const karta = document.createElement('div');
      karta.className = `tema-karta${jeOdemceno ? '' : ' tema-karta--zamcena'}`;
      karta.setAttribute('role', jeOdemceno ? 'button' : 'article');
      if (jeOdemceno) karta.setAttribute('tabindex', '0');
      karta.setAttribute('aria-label', `Téma: ${tema.nazev}${jeOdemceno ? '' : ' (zamčeno)'}`);

      karta.innerHTML = `
        <div class="tema-ikona">${tema.ikona}</div>
        <h3 class="tema-nazev">${tema.nazev}</h3>
        <p class="tema-popis">${tema.popis}</p>
        <div class="tema-meta">
          <span class="tema-pocet">${hotovo}/${celkem} úloh</span>
          <span class="tema-procent">${procent}%</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${procent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width:${procent}%"></div>
        </div>
        ${jeOdemceno ? '' : `<span class="tema-zamek" aria-hidden="true">🔒</span>`}
        ${jeOdemceno ? '' : `<p class="tema-zamceno-text">Dostupné od ${minTrida}. třídy</p>`}
      `;

      if (jeOdemceno) {
        karta.addEventListener('click', () => spustTema(tema));
        karta.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spustTema(tema); }
        });
      }

      grid.appendChild(karta);
    });
  }

  // ─── Spuštění tématu ──────────────────────────────────────────
  function spustTema(tema) {
    const trida = profil?.trida || 8;
    const filtrovaneUlohy = Syllabus.getUlohyProTridu(tema.id, trida);
    aktualniTema       = filtrovaneUlohy.length > 0
      ? { ...tema, ulohy: filtrovaneUlohy }
      : tema;
    aktualniUlohaIndex = 0;
    skore              = { spravne: 0, celkem: aktualniTema.ulohy.length };
    dialogLog          = [];
    zobrazUlohu();
    document.getElementById('uloha-tema-nazev').textContent = tema.nazev;
    nactiUlohu(0);
  }

  function spustDenniSadu() {
    if (!profil) return;
    const seed = Daily.getDailySeed();
    const sada = Daily.generateDailySet(profil.trida, tydenvRoce, seed);
    if (!sada.length) {
      alert('Žádné úlohy k dispozici. Zkontroluj nastavení třídy a týdne.');
      return;
    }
    jeDenniRezim = true;
    const denniTema = {
      id:    `denni_${seed}`,
      nazev: '📅 Dnešní sada',
      ulohy: sada
    };
    spustTema(denniTema);
  }

  // ─── Načtení úlohy (async) ────────────────────────────────────
  async function nactiUlohu(index) {
    if (index >= aktualniTema.ulohy.length) {
      jeDenniRezim = false;
      zobrazVysledky();
      return;
    }
    aktualniUlohaIndex = index;
    const uloha = aktualniTema.ulohy[index];
    dialogLog    = [];
    postupIndex  = -1;

    // Progress bar
    const procent = Math.round((index / aktualniTema.ulohy.length) * 100);
    document.getElementById('uloha-progress-fill').style.width = procent + '%';
    document.getElementById('uloha-progress-text').textContent =
      `Úloha ${index + 1} z ${aktualniTema.ulohy.length}`;

    // Kontext žáka pro engine
    const kontextZaka = profil ? {
      trida: profil.trida,
      tydenvRoce,
      odemcenaTemata: odemcenaTemata || TEMATA.map(t => t.id)
    } : null;

    const uvod = Engine.inicializuj(uloha, kontextZaka);

    // Vyčisti dialog i výpočetní panel
    document.getElementById('dialog-log').innerHTML  = '';
    document.getElementById('vypocet-log').innerHTML = '';

    pridejZpravu('system', uvod.text);

    setVstupDisabled(true);
    document.getElementById('btn-dalsi').classList.add('hidden');

    // Načti úvodní otázku (AI nebo statická)
    pokazLoadingIndikator();
    const uvodniOtazka = await Engine.getUvodniOtazka();
    skrejLoadingIndikator();

    if (uvodniOtazka.error) zobrazApiChybu(uvodniOtazka.error);
    pridejZpravu('hint', uvodniOtazka.text);

    setVstupDisabled(false);
    document.getElementById('vstup-pole').value = '';
    document.getElementById('vstup-pole').focus();
  }

  // ─── Loading indikátor ────────────────────────────────────────
  function pokazLoadingIndikator() {
    cekaNaApi = true;
    setVstupDisabled(true);
    const logEl = document.getElementById('dialog-log');
    const el    = document.createElement('div');
    el.id        = 'loading-msg';
    el.className = 'msg msg-loading msg-visible';
    el.setAttribute('aria-label', 'Přemýšlím…');
    el.innerHTML = `
      <span class="msg-ikona" aria-hidden="true">🤔</span>
      <div class="msg-obsah">
        <span class="msg-label">Přemýšlím…</span>
        <div class="loading-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    logEl.appendChild(el);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function skrejLoadingIndikator() {
    cekaNaApi = false;
    const el = document.getElementById('loading-msg');
    if (el) el.remove();
  }

  function setVstupDisabled(disabled) {
    document.getElementById('vstup-pole').disabled   = disabled;
    document.getElementById('btn-odeslat').disabled  = disabled;
  }

  // ─── Dialog ──────────────────────────────────────────────────
  function pridejZpravu(typ, text) {
    dialogLog.push({ typ, text });
    const logEl = document.getElementById('dialog-log');
    const msg   = document.createElement('div');
    msg.className = `msg msg-${typ}`;

    const ikona = { system: '📋', student: '✏️', hint: '💡', uspech: '✅', reseni: '📖', chyba: '⚠️', info: 'ℹ️', apierror: '🔌' };
    const label = { system: 'Zadání', student: 'Ty', hint: 'Nápověda', uspech: 'Správně', reseni: 'Řešení', chyba: 'Upozornění', info: 'Info', apierror: 'Chyba API' };

    msg.innerHTML = `
      <span class="msg-ikona" aria-hidden="true">${ikona[typ] || '•'}</span>
      <div class="msg-obsah">
        <span class="msg-label">${label[typ] || typ}</span>
        <p class="msg-text math-text">${escapujHtml(text)}</p>
      </div>
    `;
    logEl.appendChild(msg);
    requestAnimationFrame(() => {
      msg.classList.add('msg-visible');
      MathRender.renderMath(msg); // KaTeX rendering
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  function zobrazApiChybu(chyba) {
    pridejZpravu('apierror', `Nepodařilo se připojit k AI (${chyba}). Pokračuji se statickými nápovědami.`);
  }

  function escapujHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // ─── Výpočetní panel ─────────────────────────────────────────
  // krok = { latex, stav } z postup[] dané úlohy
  // tipTyp = 'spravne' | 'napoveda' (barva; přebito na 'vysledek' pokud krok.stav === 'vysledek')
  function pridejKrokDoVypoctu(krok, tipTyp) {
    const log = document.getElementById('vypocet-log');
    const el  = document.createElement('div');
    const cssTyp = krok.stav === 'vysledek' ? 'vysledek' : tipTyp;
    el.className = `vypocet-krok vypocet-krok--${cssTyp}`;
    el.innerHTML = MathRender.renderStep(`$${krok.latex}$`);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  // Odhal další krok z postup[] aktuální úlohy
  function odhalKrok(tipTyp) {
    const uloha = aktualniTema.ulohy[aktualniUlohaIndex];
    if (!uloha?.postup) return;
    postupIndex++;
    if (postupIndex >= uloha.postup.length) return;
    pridejKrokDoVypoctu(uloha.postup[postupIndex], tipTyp);
  }

  // Odhal všechny zbývající kroky najednou (po zobrazení řešení)
  function odhalZbytek() {
    const uloha = aktualniTema.ulohy[aktualniUlohaIndex];
    if (!uloha?.postup) return;
    while (postupIndex + 1 < uloha.postup.length) {
      odhalKrok('napoveda');
    }
  }

  // ─── Odeslání odpovědi (async) ────────────────────────────────
  async function odeslat() {
    if (cekaNaApi) return;
    const vstupEl = document.getElementById('vstup-pole');
    const vstup   = vstupEl.value.trim();
    if (!vstup) {
      vstupEl.classList.add('shake');
      setTimeout(() => vstupEl.classList.remove('shake'), 400);
      return;
    }

    pridejZpravu('student', vstup);
    vstupEl.value = '';

    pokazLoadingIndikator();
    const vysledek = await Engine.vyhodnotVstup(vstup);
    skrejLoadingIndikator();

    if (!vysledek) return;

    if (vysledek.typ === 'chyba') {
      pridejZpravu('chyba', vysledek.text);
      setVstupDisabled(false);
      return;
    }

    if (vysledek.fallback && vysledek.error) zobrazApiChybu(vysledek.error);

    if (vysledek.typ === 'napoveda') {
      pridejZpravu('hint', vysledek.text);
      odhalKrok('napoveda');
      setVstupDisabled(false);
      document.getElementById('vstup-pole').focus();
    } else if (vysledek.typ === 'uspech') {
      pridejZpravu('uspech', vysledek.text);
      odhalKrok('spravne');
      ulozProgress(
        aktualniTema._temaId || aktualniTema.id,
        aktualniTema.ulohy[aktualniUlohaIndex].id,
        true
      );
      skore.spravne++;
      dokoncUlohu();
    } else if (vysledek.typ === 'reseni') {
      pridejZpravu('reseni', vysledek.text);
      odhalZbytek();
      ulozProgress(
        aktualniTema._temaId || aktualniTema.id,
        aktualniTema.ulohy[aktualniUlohaIndex].id,
        false
      );
      dokoncUlohu();
    } else if (vysledek.typ === 'info') {
      pridejZpravu('info', vysledek.text);
      setVstupDisabled(false);
    }
  }

  function dokoncUlohu() {
    setVstupDisabled(true);
    const btnDalsi  = document.getElementById('btn-dalsi');
    btnDalsi.classList.remove('hidden');
    const jePosledni = aktualniUlohaIndex >= aktualniTema.ulohy.length - 1;
    btnDalsi.textContent = jePosledni ? 'Zobrazit výsledky' : 'Další úloha →';
    btnDalsi.focus();
  }

  // ─── Výsledková obrazovka ─────────────────────────────────────
  function renderVysledky() {
    const procent = skore.celkem > 0 ? Math.round((skore.spravne / skore.celkem) * 100) : 0;
    document.getElementById('vysledky-procent').textContent = procent + ' %';
    document.getElementById('vysledky-popis').textContent =
      procent >= 80 ? 'Výborně! Zvládáš to skvěle.' :
      procent >= 60 ? 'Dobrá práce! Ještě trochu procvičit.' :
                      'Nevzdávej to — opakování je matka moudrosti.';
    document.getElementById('vysledky-spravne').textContent = `${skore.spravne} / ${skore.celkem}`;
    document.getElementById('vysledky-breakdown').innerHTML =
      `<p>Téma: <strong>${aktualniTema.nazev}</strong> — ${skore.spravne}/${skore.celkem} správně</p>`;
  }

  // ─── API klíč (legacy mód) ────────────────────────────────────
  function ulozApiKlic() {
    const vstup   = document.getElementById('apikey-input').value.trim();
    const chybaEl = document.getElementById('apikey-chyba');
    if (!vstup) {
      chybaEl.textContent = 'Klíč nesmí být prázdný.';
      chybaEl.classList.remove('hidden');
      return;
    }
    if (!vstup.startsWith('sk-')) {
      chybaEl.textContent = 'OpenAI klíč by měl začínat na "sk-".';
      chybaEl.classList.remove('hidden');
      return;
    }
    chybaEl.classList.add('hidden');
    localStorage.setItem(CONFIG.apiKeyStorageKey, vstup);
    zobrazDomovskou();
  }

  function smazApiKlic() {
    if (confirm('Opravdu chceš smazat API klíč? Appka přejde do statického módu.')) {
      localStorage.removeItem(CONFIG.apiKeyStorageKey);
      zobrazDomovskou();
    }
  }

  // ─── Dark mode ────────────────────────────────────────────────
  function initDarkMode() {
    const btn       = document.getElementById('btn-dark-mode');
    const ulozene   = localStorage.getItem('matika_darkmode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark      = ulozene !== null ? ulozene === '1' : prefersDark;
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');

    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('matika_darkmode', '0');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('matika_darkmode', '1');
      }
    });
  }

  // ─── Auth event listenery ─────────────────────────────────────
  function initAuthEventy() {
    // Přepínání tabs login/registrace
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('auth-tab-active'));
        tab.classList.add('auth-tab-active');
        document.getElementById('auth-login').classList.toggle('hidden',    tab.dataset.tab !== 'login');
        document.getElementById('auth-register').classList.toggle('hidden', tab.dataset.tab !== 'register');
      });
    });

    // Přihlášení
    document.getElementById('btn-prihlasit').addEventListener('click', async () => {
      const email    = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const chybaEl  = document.getElementById('auth-chyba');
      chybaEl.classList.add('hidden');
      try {
        const zapamatovat = document.getElementById('auth-zapamatovat').checked;
        await Auth.prihlasuj(email, password, zapamatovat);
        // onAuthStateChange SIGNED_IN → pokracujPoLoginu() volá se přes callback
      } catch (e) {
        chybaEl.textContent = e.message;
        chybaEl.classList.remove('hidden');
      }
    });

    // Enter v login formuláři
    ['auth-email', 'auth-password'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btn-prihlasit').click();
      });
    });

    // Registrace
    document.getElementById('btn-registrovat').addEventListener('click', async () => {
      const email    = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const chybaEl  = document.getElementById('reg-chyba');
      chybaEl.classList.add('hidden');
      try {
        await Auth.registruj(email, password);
        // Supabase pošle potvrzovací e-mail
        chybaEl.style.color = 'var(--color-success)';
        chybaEl.textContent = '✅ Účet vytvořen! Zkontroluj e-mail a klikni na potvrzovací odkaz.';
        chybaEl.classList.remove('hidden');
      } catch (e) {
        chybaEl.style.color = '';
        chybaEl.textContent = e.message;
        chybaEl.classList.remove('hidden');
      }
    });

    // Odhlášení
    document.getElementById('btn-logout').addEventListener('click', async () => {
      zavriDropdown();
      await Auth.odhlas();
      profil         = null;
      odemcenaTemata = null;
      document.getElementById('user-dropdown-wrap').classList.add('hidden');
      // onAuthStateChange SIGNED_OUT → zobrazAuthScreen()
    });
  }

  // ─── Ostatní event listenery ──────────────────────────────────
  function initEventy() {
    document.getElementById('btn-odeslat').addEventListener('click', odeslat);
    document.getElementById('vstup-pole').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); odeslat(); }
    });

    document.getElementById('btn-dalsi').addEventListener('click', () => {
      nactiUlohu(aktualniUlohaIndex + 1);
    });

    document.getElementById('btn-zpet-z-ulohy').addEventListener('click', () => {
      jeDenniRezim = false;
      zobrazDomovskou();
    });
    document.getElementById('btn-zpet-z-vysledku').addEventListener('click', zobrazDomovskou);
    document.getElementById('btn-znovu').addEventListener('click', () => {
      if (aktualniTema) spustTema(aktualniTema);
    });

    // Avatar dropdown
    document.getElementById('btn-user-avatar').addEventListener('click', e => {
      e.stopPropagation();
      const dropdown = document.getElementById('user-dropdown');
      const isOpen   = !dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden');
      e.currentTarget.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', () => {
      if (!document.getElementById('user-dropdown')?.classList.contains('hidden')) {
        zavriDropdown();
      }
    });
    document.getElementById('user-dropdown').addEventListener('click', e => e.stopPropagation());

    // Výpočetní panel — smazat
    document.getElementById('btn-vypocet-smazat').addEventListener('click', () => {
      document.getElementById('vypocet-log').innerHTML = '';
    });

    // API klíč (legacy)
    document.getElementById('btn-odeslat-apikey')?.addEventListener('click', ulozApiKlic);
    document.getElementById('apikey-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') ulozApiKlic();
    });
    document.getElementById('btn-apikey-uloz')?.addEventListener('click', ulozApiKlic);
    document.getElementById('btn-apikey-smazat')?.addEventListener('click', smazApiKlic);
    document.getElementById('btn-apikey-preskocit')?.addEventListener('click', () => {
      localStorage.removeItem(CONFIG.apiKeyStorageKey);
      zobrazDomovskou();
    });
  }

  // ─── Inicializace ─────────────────────────────────────────────
  async function init() {
    initDarkMode();

    // Zaregistruj callback PŘED Auth.init() (race condition prevence)
    Auth.onSessionChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        zobrazAuthScreen();
      } else if (event === 'SIGNED_IN' && session) {
        await pokracujPoLoginu(session);
      }
    });

    const session = await Auth.init();

    initAuthEventy();
    initEventy();

    if (session) {
      await pokracujPoLoginu(session);
    } else {
      zobrazAuthScreen();
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
