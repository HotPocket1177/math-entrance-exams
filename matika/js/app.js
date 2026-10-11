// app.js — routing mezi obrazovkami, UI logika, auth gate

const App = (() => {
  // ─── Stav aplikace ───────────────────────────────────────────
  let aktualniTema       = null;
  let aktualniUlohaIndex = 0;
  let skore              = { spravne: 0, celkem: 0 };
  let dialogLog          = [];
  let cekaNaApi          = false;

  // Stav žáka (vyplní se po přihlášení)
  let profil           = null;   // { trida: 8 }
  let odemcenaTemata   = null;   // string[] nebo null (= vše odemčeno)

  // ─── Auth guards ─────────────────────────────────────────────
  let _signOutTimer    = null;   // debounce timer — zabraňuje falešnému odhlášení při obnově tokenu
  let _pokracujBezi    = false;  // guard proti souběžným voláním pokracujPoLoginu

  // ─── Concurrency guards ───────────────────────────────────────
  // INVARIANT: spustiSadu() (count++) se volá VÝHRADNĚ z dokonceniSady(),
  // nikdy z spustTema(). Tím se count přičítá jen při skutečném dokončení.
  // Tyto guardy zajišťují, že spustTema ani dokonceniSady nemohou běžet
  // souběžně (dvojklik, race condition) a tím double-chargovat cycle.
  let _spustTemaBeziPro = false;  // brání souběžnému spouštění (dvojklik, race)
  let _sadaSeKonci      = false;  // brání double-volání dokonceniSady
  let _sadaZapoctena    = false;  // true = spustiSadu bylo voláno pro tento cyklus
  let _posledniDokoncena = false; // true = uživatel dokončil poslední úlohu v sadě

  // ─── Per-cyklus výběr úloh ───────────────────────────────────
  const TASKS_PER_CYCLE    = 5;
  const HISTORY_KEY        = 'matika_history';           // { temaId: { taskId: timestampMs } }
  const SESSION_KEY        = 'matika_session_sada';      // sessionStorage: sadaId pro obnovu po hard refreshi
  const ROZPRACOVANE_KEY   = 'matika_rozpracovane';      // localStorage: rozpracované sady (panel na home)
  const TYP_ULOH_KEY       = 'matika_typ_uloh';          // localStorage: { temaId: 'slovni' | 'priklady' }
  const VYSLEDKY_KEY       = 'matika_vysledky';          // localStorage: { temaId: { spravne, celkem } }
  // Tři klíče výše se ukládají pod ID uživatele (klicUzivatele) — po odhlášení zůstanou
  // svému majiteli, ale jiný uživatel na stejném počítači je neuvidí.
  const KLICE_UZIVATELE    = [ROZPRACOVANE_KEY, TYP_ULOH_KEY, VYSLEDKY_KEY];

  function klicUzivatele(zaklad) {
    const uid = Auth.getSession()?.user?.id;
    return uid ? `${zaklad}__${uid}` : zaklad;
  }

  // Data uložená před zavedením klíčů s ID uživatele převezme první přihlášený
  function prevezmiStaraData() {
    KLICE_UZIVATELE.forEach(zaklad => {
      const stary = localStorage.getItem(zaklad);
      if (stary === null) return;
      if (localStorage.getItem(klicUzivatele(zaklad)) === null) {
        try { localStorage.setItem(klicUzivatele(zaklad), stary); } catch {}
      }
      localStorage.removeItem(zaklad);
    });
  }
  const COOLDOWN_PRIMARY   = 30 * 24 * 60 * 60 * 1000;  // 30 dní (ideál)
  const COOLDOWN_SECONDARY =  7 * 24 * 60 * 60 * 1000;  // 7 dní (fallback)

  // ─── Mix — úlohy z různých témat jako u přijímaček ───────────
  // Žák předem neví, jaké téma přijde → trénuje poznat, jak úlohu začít.
  // Každá úloha nese vlastní temaId (progress se ukládá k jejímu tématu).
  const MIX_TEMA = {
    id:     'mix',
    nazev:  'Mix jako u přijímaček',
    ikona:  '🎲',
    popis:  'Pět úloh z různých témat. Předem nevíš, co přijde — přesně jako u testu.',
    ulohy:  []
  };

  const TEMA_BARVY = {
    slovni: '#6366f1', procenta: '#ec4899', zlomky: '#f59e0b',
    rovnice: '#10b981', geometrie: '#0ea5e9', grafy: '#8b5cf6', mix: '#f97316'
  };

  // ─── Typ úloh: slovní úlohy × jen příklady ───────────────────
  // Jen u témat, kde dává smysl obojí (slovní úlohy jsou slovní vždy, grafy potřebují data).
  const TEMATA_S_VOLBOU_TYPU = ['zlomky', 'procenta', 'rovnice', 'geometrie'];

  function _nactiTypy() {
    try { return JSON.parse(localStorage.getItem(klicUzivatele(TYP_ULOH_KEY)) || '{}'); } catch { return {}; }
  }

  // true = slovní úlohy (výchozí), false = jen početní příklady
  function jeSlovniVolba(temaId) {
    if (!TEMATA_S_VOLBOU_TYPU.includes(temaId)) return true;
    return _nactiTypy()[temaId] !== 'priklady';
  }

  function nastavTypUloh(temaId, slovni) {
    const typy = _nactiTypy();
    typy[temaId] = slovni ? 'slovni' : 'priklady';
    _zapisTypy(typy);
    Sync.ulozTypy(typy);
  }

  function _zapisTypy(typy) {
    try { localStorage.setItem(klicUzivatele(TYP_ULOH_KEY), JSON.stringify(typy)); } catch {}
  }

  // Generované úlohy nesou příznak; statické se poznají podle začátku zadání
  // („Vypočítej…“, „Vyřeš…“, holý výraz, „Čtverec má…“ = příklad bez příběhu).
  const ZACATEK_PRIKLADU = /^(Vypočítej|Vyřeš|Zjednoduš|Zkrať|Zapiš|Kolik je|Najdi|Nerovnici|Který ze zlomků|Urči|\$|Pravoúhlý|Rovnoramenný|Trojúhelník|Čtverec|Obdélník|Kosočtverec|Kruh|Válec|Kvádr)/;
  function jeSlovniUloha(u) {
    if (typeof u.slovni === 'boolean') return u.slovni;
    return !ZACATEK_PRIKLADU.test((u.zadani || '').trim());
  }

  function najdiTema(id) {
    return id === MIX_TEMA.id ? MIX_TEMA : TEMATA.find(t => t.id === id);
  }

  // Témata, která má žák v aktuální třídě odemčená (mají aspoň jednu úlohu)
  function odemcenaTemataProMix(trida) {
    return TEMATA.filter(t => Syllabus.getUlohyProTridu(t.id, trida).length > 0).map(t => t.id);
  }

  // ─── Rozpracované sady (localStorage) ─────────────────────────
  // Každá spuštěná sada má vlastní sadaId a ukládá se celá (úlohy, pozice, skóre),
  // aby se k ní žák mohl kdykoli vrátit z panelu „Rozpracované“ na domovské obrazovce.
  // V panelu se zobrazují jen sady, ve kterých žák už něco udělal (pokrok: true).
  // Klíč: matika_rozpracovane → { [sadaId]: { sadaId, temaId, nazev, ikona, ulohy, index, skore, pokrok, upraveno } }
  const MAX_ROZPRACOVANYCH = 20;

  function nactiRozpracovane() {
    try { return JSON.parse(localStorage.getItem(klicUzivatele(ROZPRACOVANE_KEY)) || '{}'); }
    catch { return {}; }
  }

  function _zapisRozpracovane(mapa) {
    try { localStorage.setItem(klicUzivatele(ROZPRACOVANE_KEY), JSON.stringify(mapa)); }
    catch { /* localStorage plný — tiše ignoruj */ }
  }

  function novaSadaId() {
    return `sada_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  // Udělal žák v aktuální úloze něco sám? (odpověď, volba začátku, nápověda)
  function _maPokrokVUloze() {
    const e = Engine.getStav();
    return dialogLog.some(m => m.typ === 'student' || m.typ === 'volba')
      || e.zacatekChyby?.length > 0 || e.pocetNapoved > 0;
  }

  // Uloží aktuální sadu. Hotová úloha posune pozici na další, aby se po návratu neopakovala.
  function ulozRozpracovanou({ pokrok = false } = {}) {
    if (!aktualniTema?.ulohy?.length || !aktualniTema.sadaId) return;
    const mapa     = nactiRozpracovane();
    const sadaId   = aktualniTema.sadaId;
    const uloha    = aktualniTema.ulohy[aktualniUlohaIndex];
    const hotova   = Engine.getStav().uloha === uloha && Engine.jeDokonceno();

    mapa[sadaId] = {
      sadaId,
      temaId:   aktualniTema._temaId || aktualniTema.id,
      nazev:    aktualniTema.nazev,
      ikona:    aktualniTema.ikona,
      // kontrola je funkce — nelze serializovat; obnoví se přes _rekonstruujKontrola
      ulohy:    aktualniTema.ulohy.map(({ kontrola, ...rest }) => rest),
      index:    hotova ? aktualniUlohaIndex + 1 : aktualniUlohaIndex,
      skore:    { ...skore },
      pokrok:   pokrok || mapa[sadaId]?.pokrok || aktualniUlohaIndex > 0,
      upraveno: Date.now(),
      synchronizovano: mapa[sadaId]?.synchronizovano || false
    };

    // Nejstarší sady nad limit zahoď (i s jejich konverzacemi)
    Object.values(mapa)
      .sort((a, b) => b.upraveno - a.upraveno)
      .slice(MAX_ROZPRACOVANYCH)
      .forEach(s => { _smazSaduZMapy(mapa, s.sadaId); Sync.smazSadu(s.sadaId); });

    _zapisRozpracovane(mapa);
    Sync.naplanujSadu(sadaId);
    sessionStorage.setItem(SESSION_KEY, sadaId);  // obnova po hard refreshi ve stejném tabu
  }

  function _smazSaduZMapy(mapa, sadaId) {
    (mapa[sadaId]?.ulohy || []).forEach(u => localStorage.removeItem(_konvKlic(sadaId, u.id)));
    delete mapa[sadaId];
  }

  function smazRozpracovanou(sadaId) {
    if (!sadaId) return;
    const mapa = nactiRozpracovane();
    _smazSaduZMapy(mapa, sadaId);
    _zapisRozpracovane(mapa);
    Sync.smazSadu(sadaId);
    if (sessionStorage.getItem(SESSION_KEY) === sadaId) sessionStorage.removeItem(SESSION_KEY);
  }

  // Sady, ve kterých žák nic neudělal, se v panelu neukazují — při startu nové sady je zahoď
  function uklidNedotceneSady() {
    const mapa = nactiRozpracovane();
    Object.values(mapa).filter(s => !s.pokrok).forEach(s => _smazSaduZMapy(mapa, s.sadaId));
    _zapisRozpracovane(mapa);
  }

  // ─── Persistence konverzace (localStorage) ───────────────────
  // Klíč: matika_konv__{sadaId}__{ulohaId}
  // Ukládá: dialogLog + engine stav — vše potřebné pro obnovu.
  function _konvKlic(sadaId, ulohaId) {
    return `matika_konv__${sadaId}__${ulohaId}`;
  }

  function ulozKonverzaci() {
    if (!aktualniTema?.sadaId || aktualniUlohaIndex == null) return;
    // Jen když je úloha otevřená — jinak by např. skrytí tabu na home screenu
    // znovu uložilo sadu, kterou žák mezitím smazal z panelu Rozpracované.
    if (document.getElementById('screen-uloha').classList.contains('hidden')) return;
    const uloha = aktualniTema.ulohy[aktualniUlohaIndex];
    if (!uloha || Engine.getStav().uloha !== uloha) return;
    try {
      const data = {
        dialogLog:  dialogLog.slice(),
        engineStav: Engine.ulozStav(),
      };
      localStorage.setItem(_konvKlic(aktualniTema.sadaId, uloha.id), JSON.stringify(data));
    } catch { /* localStorage plný — tiše ignoruj */ }
    ulozRozpracovanou({ pokrok: _maPokrokVUloze() });
  }

  function obnovKonverzaci(sadaId, ulohaId) {
    try {
      const raw = localStorage.getItem(_konvKlic(sadaId, ulohaId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function smazKonverzaci(sadaId, ulohaId) {
    localStorage.removeItem(_konvKlic(sadaId, ulohaId));
  }

  // Odhlášení: smaže sdílená data, ale data navázaná na ID uživatele (avatar,
  // rozpracované sady a jejich konverzace, výsledky, volba typu úloh) nechá —
  // po dalším přihlášení je majitel najde, jiný uživatel je neuvidí.
  // Smazání účtu (smazatVse): odstraní i osobní data aktuálního uživatele.
  function vycistiLocalStorage({ smazatVse = false } = {}) {
    const uid = Auth.getSession()?.user?.id;
    const jeOsobni = k => /__[0-9a-f-]{36}$/.test(k) || /^matika_avatar_/.test(k) || k.startsWith('matika_konv__sada_');

    if (smazatVse && uid) {
      Object.keys(nactiRozpracovane()).forEach(sadaId => smazRozpracovanou(sadaId));
    }

    const smazat = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('matika_') || key === 'matika_darkmode') continue;
      const mojeOsobni = uid && (key.endsWith(`__${uid}`) || key === `matika_avatar_${uid}`);
      if (jeOsobni(key) && !(smazatVse && mojeOsobni)) continue;
      smazat.push(key);
    }
    smazat.forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem(SESSION_KEY);
  }

  function _rekonstruujKontrola(u) {
    // Statické příklady: kontrola funkce je uložena v TEMATA
    if (!u.id.startsWith('gen_')) {
      for (const t of TEMATA) {
        const nalezena = (t.ulohy || []).find(s => s.id === u.id);
        if (nalezena?.kontrola) return nalezena.kontrola;
      }
    }
    // AI-generované: _meta obsahuje answerType/answerValue/tolerance/keywords
    if (u._meta) return Generator.makeKontrola(u._meta);
    // Poslední záchrana — porovnání s textem odpovědi (číselně, jinak celá shoda)
    return Generator.makeKontrola({ odpoved: u.odpoved });
  }

  // ─── Správa obrazovek ─────────────────────────────────────────
  const SCREENS = ['screen-auth', 'screen-home', 'screen-uloha', 'screen-vysledky', 'screen-profil', 'screen-statistiky'];

  function zobrazScreen(id) {
    SCREENS.forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  }

  function zobrazDomovskou()  { zobrazScreen('screen-home');    renderTemata(); }
  function zobrazProfil()     {
    const email = Auth.getSession()?.user?.email || '';
    document.getElementById('profil-email-text').textContent = email;
    renderProfilAvatar(email);
    renderProfilTridy();
    document.getElementById('profil-chk-email').checked = profil?.email_updates === true;
    document.getElementById('profil-chk-dark').checked  = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('profil-zprava').classList.add('hidden');
    zavriDropdown();
    zobrazScreen('screen-profil');
  }

  // ─── Avatar: zobrazení + upload ──────────────────────────────
  function _avatarKlic() {
    const uid = Auth.getSession()?.user?.id;
    return uid ? `matika_avatar_${uid}` : null;
  }

  function renderProfilAvatar(email) {
    const el    = document.getElementById('profil-avatar-inicialy');
    const klic  = _avatarKlic();
    const saved = klic ? localStorage.getItem(klic) : null;
    if (saved) {
      const img = `<img src="${saved}" alt="Profilovka" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      el.innerHTML = img;
      const hdr = document.getElementById('avatar-inicialy');
      if (hdr) hdr.innerHTML = `<img src="${saved}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      const ini = (email || '?').charAt(0).toUpperCase();
      el.textContent = ini;
      const hdr = document.getElementById('avatar-inicialy');
      if (hdr) hdr.textContent = ini;
    }
  }

  function initAvatarUpload() {
    const btnZmenit = document.getElementById('btn-avatar-zmenit');
    const input     = document.getElementById('input-avatar');
    if (!btnZmenit || !input) return;

    btnZmenit.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert('Fotka je příliš velká. Vyber obrázek do 10 MB.');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => otevriCropModal(e.target.result);
      reader.readAsDataURL(file);
      input.value = '';
    });
  }

  // ─── Avatar crop modal ────────────────────────────────────────
  let _cropImg      = null;
  let _cropDragX    = 0;
  let _cropDragY    = 0;
  let _cropScale    = 1;
  let _cropMinScale = 1;
  let _cropDragging = false;
  let _cropLastX    = 0;
  let _cropLastY    = 0;

  const CROP_SIZE = 280;  // px crop window

  function otevriCropModal(dataUrl) {
    const img = new Image();
    img.onload = () => {
      _cropImg      = img;
      _cropMinScale = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight);
      _cropScale    = _cropMinScale;
      _cropDragX    = 0;
      _cropDragY    = 0;

      const slider  = document.getElementById('avatar-crop-zoom-slider');
      slider.min    = _cropMinScale;
      slider.max    = _cropMinScale * 4;
      slider.value  = _cropScale;

      _renderCropImg();
      document.getElementById('modal-avatar-crop').classList.remove('hidden');
    };
    img.src = dataUrl;
  }

  function _renderCropImg() {
    const imgEl = document.getElementById('avatar-crop-img');
    const w = _cropImg.naturalWidth  * _cropScale;
    const h = _cropImg.naturalHeight * _cropScale;
    imgEl.src          = _cropImg.src;
    imgEl.style.width  = `${w}px`;
    imgEl.style.height = `${h}px`;
    imgEl.style.left   = `${CROP_SIZE / 2 + _cropDragX - w / 2}px`;
    imgEl.style.top    = `${CROP_SIZE / 2 + _cropDragY - h / 2}px`;
  }

  function _clampCropDrag() {
    const halfW = (_cropImg.naturalWidth  * _cropScale) / 2;
    const halfH = (_cropImg.naturalHeight * _cropScale) / 2;
    const half  = CROP_SIZE / 2;
    _cropDragX  = Math.max(half - halfW, Math.min(halfW - half, _cropDragX));
    _cropDragY  = Math.max(half - halfH, Math.min(halfH - half, _cropDragY));
  }

  function initCropModalEventy() {
    const okno   = document.getElementById('avatar-crop-okno');
    const slider = document.getElementById('avatar-crop-zoom-slider');

    // Drag — mouse
    okno.addEventListener('mousedown', (e) => {
      _cropDragging = true;
      _cropLastX    = e.clientX;
      _cropLastY    = e.clientY;
      okno.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!_cropDragging) return;
      _cropDragX += e.clientX - _cropLastX;
      _cropDragY += e.clientY - _cropLastY;
      _cropLastX  = e.clientX;
      _cropLastY  = e.clientY;
      _clampCropDrag();
      _renderCropImg();
    });
    document.addEventListener('mouseup', () => {
      if (_cropDragging) { _cropDragging = false; okno.style.cursor = 'grab'; }
    });

    // Drag — touch
    okno.addEventListener('touchstart', (e) => {
      _cropDragging = true;
      _cropLastX    = e.touches[0].clientX;
      _cropLastY    = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });
    okno.addEventListener('touchmove', (e) => {
      if (!_cropDragging) return;
      _cropDragX += e.touches[0].clientX - _cropLastX;
      _cropDragY += e.touches[0].clientY - _cropLastY;
      _cropLastX  = e.touches[0].clientX;
      _cropLastY  = e.touches[0].clientY;
      _clampCropDrag();
      _renderCropImg();
      e.preventDefault();
    }, { passive: false });
    okno.addEventListener('touchend', () => { _cropDragging = false; });

    // Zoom slider
    slider.addEventListener('input', () => {
      _cropScale = parseFloat(slider.value);
      _clampCropDrag();
      _renderCropImg();
    });

    // Zrušit
    document.getElementById('btn-avatar-crop-zrusit').addEventListener('click', () => {
      document.getElementById('modal-avatar-crop').classList.add('hidden');
    });

    // Uložit — vykreslit na canvas a exportovat JPEG
    document.getElementById('btn-avatar-crop-ulozit').addEventListener('click', () => {
      const out = 256;
      const canvas = document.createElement('canvas');
      canvas.width  = out;
      canvas.height = out;
      const ctx = canvas.getContext('2d');

      // Kruhový clip
      ctx.beginPath();
      ctx.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2);
      ctx.clip();

      // Zdrojový obdélník v přirozených pixelech obrázku
      const srcW = CROP_SIZE / _cropScale;
      const srcH = CROP_SIZE / _cropScale;
      const srcX = _cropImg.naturalWidth  / 2 - (CROP_SIZE / 2 + _cropDragX) / _cropScale;
      const srcY = _cropImg.naturalHeight / 2 - (CROP_SIZE / 2 + _cropDragY) / _cropScale;

      ctx.drawImage(_cropImg, srcX, srcY, srcW, srcH, 0, 0, out, out);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const klic = _avatarKlic();
      if (klic) localStorage.setItem(klic, dataUrl);

      const email = Auth.getSession()?.user?.email || '';
      renderProfilAvatar(email);
      document.getElementById('modal-avatar-crop').classList.add('hidden');
    });
  }

  // ─── Profil: výběr třídy ─────────────────────────────────────
  let _profilNovaTrida = null;  // lokální stav před uložením

  function renderProfilTridy() {
    const wrap = document.getElementById('profil-tridy');
    wrap.innerHTML = '';
    _profilNovaTrida = profil?.trida || 8;
    [6, 7, 8, 9].forEach(t => {
      const btn = document.createElement('button');
      btn.className = `profil-trida-karta${t === _profilNovaTrida ? ' aktivni' : ''}`;
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', t === _profilNovaTrida ? 'true' : 'false');
      btn.innerHTML = `<span class="profil-trida-cislo">${t}.</span><span class="profil-trida-text">třída</span>`;
      btn.addEventListener('click', () => {
        _profilNovaTrida = t;
        wrap.querySelectorAll('.profil-trida-karta').forEach((el, i) => {
          const active = [6, 7, 8, 9][i] === t;
          el.classList.toggle('aktivni', active);
          el.setAttribute('aria-pressed', String(active));
        });
      });
      wrap.appendChild(btn);
    });
  }

  async function ulozProfil() {
    const btn = document.getElementById('btn-profil-ulozit');
    btn.disabled = true;
    btn.textContent = 'Ukládám…';

    const novaTrida  = _profilNovaTrida || profil?.trida || 8;
    const emailOpt   = document.getElementById('profil-chk-email').checked;
    const darkMode   = document.getElementById('profil-chk-dark').checked;
    const sb         = Auth.getSupabase();
    const userId     = Auth.getSession()?.user?.id;

    const { error } = await sb.from('profiles')
      .update({ trida: novaTrida, email_updates: emailOpt })
      .eq('id', userId);

    btn.disabled = false;
    btn.textContent = 'Uložit změny';

    const zpravaEl = document.getElementById('profil-zprava');
    if (error) {
      zpravaEl.textContent = 'Chyba při ukládání. Zkus to znovu.';
      zpravaEl.className   = 'profil-zprava profil-zprava--chyba';
    } else {
      profil         = { ...profil, trida: novaTrida, email_updates: emailOpt };
      odemcenaTemata = Syllabus.getOdemcenaTemataPoTridu(novaTrida);
      zpravaEl.textContent = '✓ Změny uloženy';
      zpravaEl.className   = 'profil-zprava profil-zprava--ok';
      // Aplikuj dark mode
      if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      localStorage.setItem('matika_darkmode', darkMode ? '1' : '0');
    }
    zpravaEl.classList.remove('hidden');
    setTimeout(() => zpravaEl.classList.add('hidden'), 3000);
  }

  // ─── GDPR: export dat ─────────────────────────────────────────
  async function exportDat() {
    const sb     = Auth.getSupabase();
    const userId = Auth.getSession()?.user?.id;
    const email  = Auth.getSession()?.user?.email;

    const [profilRes, progressRes, sessionRes, aiRes, hlaseniRes, sadyRes] = await Promise.all([
      sb.from('profiles').select('*').eq('id', userId).single(),
      sb.from('progress').select('*').eq('user_id', userId),
      sb.from('session_progress').select('*').eq('user_id', userId),
      sb.from('ai_pouziti').select('*').eq('user_id', userId),
      sb.from('nahlasene_chyby').select('*').eq('user_id', userId),
      sb.from('rozpracovane_sady').select('*').eq('user_id', userId),
    ]);

    const exportData = {
      exportDatum: new Date().toISOString(),
      uzivatel:    { id: userId, email },
      profil:      profilRes.data,
      progress:    progressRes.data,
      sessionProgress: sessionRes.data,
      aiPouziti:       aiRes.data,
      nahlaseneChyby:  hlaseniRes.data,
      rozpracovaneSady: sadyRes.data,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `matika-moje-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── GDPR: smazání účtu ───────────────────────────────────────
  async function smazatUcet() {
    const potvrzeni = confirm(
      'Opravdu chceš smazat svůj účet?\n\nBudou trvale odstraněna všechna tvá data (výsledky, postup, nastavení). Tuto akci nelze vrátit.'
    );
    if (!potvrzeni) return;

    const zpravaEl = document.getElementById('profil-gdpr-zprava');
    const btnSmazat = document.getElementById('btn-smazat-ucet');
    btnSmazat.disabled = true;
    btnSmazat.textContent = 'Mažu…';

    try {
      const jwt = Auth.getJwt();
      const res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/delete-account`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${jwt}` },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Neznámá chyba');

      // Nejdřív smaž lokální data včetně avataru (GDPR — smazání účtu), pak odhlás
      vycistiLocalStorage({ smazatVse: true });
      profil         = null;
      odemcenaTemata = null;
      SessionProgress.resetCache();
      document.getElementById('user-dropdown-wrap').classList.add('hidden');
      await Auth.odhlas();  // → SIGNED_OUT → zobrazAuthScreen() přes handler
    } catch (e) {
      btnSmazat.disabled = false;
      btnSmazat.textContent = 'Smazat účet';
      zpravaEl.textContent = `Chyba: ${e.message}`;
      zpravaEl.className = 'profil-zprava profil-zprava--chyba';
      zpravaEl.classList.remove('hidden');
      setTimeout(() => zpravaEl.classList.add('hidden'), 5000);
    }
  }

  function zobrazUlohu()      { zobrazScreen('screen-uloha'); }
  function zobrazVysledky()   { zobrazScreen('screen-vysledky'); renderVysledky(); }
  function zobrazAuthScreen() {
    // Vyčisti oba formuláře — zabrání zobrazení starých dat po smazání účtu
    document.getElementById('auth-email').value    = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-chyba').classList.add('hidden');
    document.getElementById('reg-email').value    = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-chyba').classList.add('hidden');
    const chk = document.getElementById('chk-gdpr-souhlas');
    if (chk) { chk.checked = false; document.getElementById('btn-registrovat').disabled = true; }
    zobrazScreen('screen-auth');
  }

  // ─── Statistiky ───────────────────────────────────────────────
  function zobrazStatistiky() {
    renderStatistiky();
    // Resetuj animaci karet — vrátit na start stav
    document.querySelectorAll('.stats-tcg-karta').forEach(card => {
      card.style.animation = 'none';
      card.style.opacity   = '0';
      card.style.transform = `translateY(120px) scale(0.3) rotate(calc(var(--rot, 0deg) * 2.5))`;
    });
    zobrazScreen('screen-statistiky');
    // Spusť animaci po rendrování
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('.stats-tcg-karta').forEach(card => {
        card.style.animation = '';
        card.style.opacity   = '';
        card.style.transform = '';
      });
    }));
  }

  function renderStatistiky() {
    const trida    = profil?.trida || 8;
    const vysledky = nactiVysledky();
    const temaData = [];
    let celkemSpravne = 0, celkemVyreseno = 0;

    TEMATA.forEach(tema => {
      if (!Syllabus.getUlohyProTridu(tema.id, trida).length) return;
      const { spravne = 0, celkem = 0 } = vysledky[tema.id] || {};
      const procent = celkem > 0 ? Math.round((spravne / celkem) * 100) : 0;
      celkemSpravne  += spravne;
      celkemVyreseno += celkem;
      temaData.push({ tema, spravne, celkem, procent });
    });

    // Summary karty
    const uspesnost  = celkemVyreseno > 0 ? Math.round((celkemSpravne / celkemVyreseno) * 100) : 0;
    const sadyDnes   = [...TEMATA, MIX_TEMA].reduce((s, t) => s + SessionProgress.getDokonceniCount(t.id), 0);
    const sadyCelkem = SessionProgress.getCelkoveSady();
    document.getElementById('stats-splneno').textContent   = `${sadyCelkem}`;
    document.getElementById('stats-uspesnost').textContent = `${uspesnost} %`;
    document.getElementById('stats-dnes').textContent      = `${sadyDnes}`;

    // Seznam témat — procvičená od nejhoršího %, neprocvičená na konci
    temaData.sort((a, b) => (b.celkem > 0) - (a.celkem > 0) || a.procent - b.procent);
    const listEl = document.getElementById('stats-temata-list');
    listEl.innerHTML = temaData.map(({ tema, spravne, celkem, procent }) => `
      <div class="stats-tema-radek">
        <span class="stats-tema-ikona">${tema.ikona}</span>
        <div class="stats-tema-info">
          <div class="stats-tema-hlavicka">
            <span class="stats-tema-nazev">${tema.nazev}</span>
            <span class="stats-tema-procent">${celkem > 0 ? procent + ' %' : '—'}</span>
          </div>
          <div class="stats-bar-wrap">
            <div class="stats-bar-fill" style="width:${procent}%"></div>
          </div>
          <div class="stats-tema-detail">${celkem > 0
            ? `${spravne} z ${celkem} úloh správně${celkem - spravne > 0 ? ` · ${celkem - spravne} s ukázaným řešením` : ''}`
            : 'Zatím neprocvičeno'}</div>
        </div>
      </div>
    `).join('');

    // Highlights — jen z procvičených témat
    const procvicena = temaData.filter(d => d.celkem > 0);
    const nejlepsi = [...procvicena].sort((a, b) => b.procent - a.procent)[0];
    const nejhorsi = [...procvicena].sort((a, b) => a.procent - b.procent)[0];
    const hlEl = document.getElementById('stats-highlights');
    if (nejlepsi && nejhorsi && nejlepsi.tema.id !== nejhorsi.tema.id) {
      hlEl.innerHTML = `
        <div class="stats-highlight stats-highlight--best">
          <span>🏆</span><div><strong>Nejlepší</strong><br>${nejlepsi.tema.nazev} — ${nejlepsi.procent} %</div>
        </div>
        <div class="stats-highlight stats-highlight--warn">
          <span>⚠</span><div><strong>K procvičení</strong><br>${nejhorsi.tema.nazev} — ${nejhorsi.procent} %</div>
        </div>
      `;
      hlEl.classList.remove('hidden');
    } else {
      hlEl.classList.add('hidden');
    }
  }

  function initStatsTcgKarty() {
    document.querySelectorAll('.stats-tcg-karta').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect  = card.getBoundingClientRect();
        const mx    = (e.clientX - rect.left) / rect.width;
        const my    = (e.clientY - rect.top)  / rect.height;
        const tiltX = (my - 0.5) * 22;
        const tiltY = (mx - 0.5) * -22;
        card.style.setProperty('--mx', mx);
        card.style.setProperty('--my', my);
        card.style.animation  = 'none';
        card.style.opacity    = '1';
        card.style.transform  = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-12px) scale(1.06)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--mx', 0.5);
        card.style.setProperty('--my', 0.5);
        card.style.transform = '';
        card.style.animation = 'statsCardHover 3.5s ease-in-out infinite';
      });
    });
  }

  // ─── Po úspěšném přihlášení ───────────────────────────────────
  async function pokracujPoLoginu(session) {
    prevezmiStaraData();
    profil = await Auth.getProfil();

    // Pokud profil neexistuje (nový účet nebo selhala tvorba při registraci),
    // vytvoř ho teď — session_progress má FK na profiles(id), bez profilu
    // všechny zápisy selžou s FK violation a progress se neuloží.
    if (!profil) {
      const userId = session?.user?.id || Auth.getSession()?.user?.id;
      await Auth.getSupabase()
        .from('profiles')
        .upsert({ id: userId, trida: 8, onboarding_done: false }, { onConflict: 'id' });
      profil = { trida: 8, onboarding_done: false };
    }

    odemcenaTemata = Syllabus.getOdemcenaTemataPoTridu(profil?.trida || 8);

    // Načti session progress (denní limity)
    const userId = session?.user?.id || Auth.getSession()?.user?.id;
    await SessionProgress.nactiVse(userId);

    // Seed kumulativního počítadla sad z DB (source of truth pro cross-device sync)
    if ((profil?.sady_celkem ?? 0) > 0) {
      const localCount = parseInt(localStorage.getItem('matika_sady_celkem') || '0', 10);
      if (profil.sady_celkem > localCount) {
        localStorage.setItem('matika_sady_celkem', profil.sady_celkem.toString());
      }
    }

    // Hlavička — zobraz avatar dropdown
    const email = session?.user?.email || Auth.getSession()?.user?.email || '';
    document.getElementById('dropdown-email').textContent  = email;
    document.getElementById('user-dropdown-wrap').classList.remove('hidden');
    renderProfilAvatar(email);
    renderDropdownTridy();

    // Data z jiných zařízení (rozpracované sady, statistiky, volba typu úloh).
    // Na pomalou síť nečekáme déle než 4 s — synchronizace pak doběhne na pozadí.
    const synchronizace = Sync.stahniVse();
    const vcas = await Promise.race([
      synchronizace.then(() => true),
      new Promise(r => setTimeout(() => r(false), 4000))
    ]);
    if (!vcas) synchronizace.then(zmena => { if (zmena) obnovDomovskouPoSynchronizaci(); });

    // Obnova po hard refresh — pokud byl uživatel uprostřed sady, vrátíme ho tam
    const sadaPoRefreshi = sessionStorage.getItem(SESSION_KEY);
    if (sadaPoRefreshi && nactiRozpracovane()[sadaPoRefreshi]) {
      await pokracujVSade(sadaPoRefreshi);
      return;
    }

    zobrazDomovskou();
    // Nový uživatel dostane tutorial — „Co je nového“ by se mu otevřelo přes něj
    if (!zkontrolujOnboarding()) zkontrolujNovinky();
  }

  // Po synchronizaci překresli domovskou obrazovku (panel Rozpracované, procenta témat)
  function obnovDomovskouPoSynchronizaci() {
    if (!document.getElementById('screen-home').classList.contains('hidden')) renderTemata();
  }

  // ─── Dropdown: výběr třídy ────────────────────────────────────
  function renderDropdownTridy() {
    // Dropdown je teď minimální — třída a e-mail jsou v profilové stránce
    const email = Auth.getSession()?.user?.email || '';
    document.getElementById('dropdown-email').textContent = email;
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

  // ─── Novinky: modal "Co je nového" ───────────────────────────
  // ─── Onboarding ──────────────────────────────────────────────
  // ─── Onboarding tutorial ─────────────────────────────────────
  const OB_STEPS    = 7;
  let _obKrok       = 1;
  let _obTrida      = null;

  // Vrací true, pokud se tutorial zobrazil
  function zkontrolujOnboarding() {
    if (profil?.onboarding_done === true) return false;
    _obKrok  = 1;
    _obTrida = profil?.trida || 8;
    _obRenderTridy();
    _obAktualizuj();
    document.getElementById('modal-onboarding').classList.remove('hidden');
    return true;
  }

  function _obAktualizuj() {
    // Zobraz správný krok
    for (let i = 1; i <= OB_STEPS; i++) {
      document.getElementById(`ob-step-${i}`)?.classList.toggle('hidden', i !== _obKrok);
    }
    // Dots
    const dots = document.getElementById('ob-dots');
    if (dots) {
      dots.innerHTML = Array.from({ length: OB_STEPS }, (_, i) =>
        `<span class="ob-dot${i + 1 === _obKrok ? ' ob-dot--aktivni' : ''}"></span>`
      ).join('');
    }
    // Tlačítka
    const btnZpet  = document.getElementById('btn-ob-zpet');
    const btnDalsi = document.getElementById('btn-ob-dalsi');
    if (btnZpet)  btnZpet.classList.toggle('hidden', _obKrok === 1);
    if (btnDalsi) {
      if (_obKrok === OB_STEPS) {
        btnDalsi.textContent = 'Začít procvičovat 🚀';
      } else {
        btnDalsi.textContent = 'Pokračovat →';
      }
      // Krok 2 (výběr třídy) — vždy enabled (výchozí třída je předvybraná)
      btnDalsi.disabled = false;
    }
  }

  function _obRenderTridy() {
    const wrap = document.getElementById('onboarding-tridy');
    if (!wrap) return;
    wrap.innerHTML = [6, 7, 8, 9].map(t => `
      <button class="profil-trida-karta${t === _obTrida ? ' aktivni' : ''}" data-trida="${t}">
        <span class="profil-trida-cislo">${t}.</span>
        <span class="profil-trida-text">třída</span>
      </button>
    `).join('');
    wrap.querySelectorAll('.profil-trida-karta').forEach(btn => {
      btn.addEventListener('click', () => {
        _obTrida = Number(btn.dataset.trida);
        wrap.querySelectorAll('.profil-trida-karta').forEach(b => b.classList.remove('aktivni'));
        btn.classList.add('aktivni');
      });
    });
  }

  async function _obDalsi() {
    if (_obKrok < OB_STEPS) {
      _obKrok++;
      _obAktualizuj();
    } else {
      await _obDokoncit();
    }
  }

  function _obZpet() {
    if (_obKrok > 1) { _obKrok--; _obAktualizuj(); }
  }

  async function _obDokoncit() {
    document.getElementById('modal-onboarding').classList.add('hidden');
    if (_obTrida && _obTrida !== profil?.trida) {
      await zmenTridu(_obTrida);
    }
    await Auth.ulozOnboardingDone();
    // Tutorial popisuje aktuální verzi — „Co je nového“ už nový uživatel nepotřebuje
    await Auth.ulozVerziZobrazeni(CONFIG.appVersion);
    profil = { ...profil, onboarding_done: true, last_seen_version: CONFIG.appVersion };
  }

  async function zkontrolujNovinky() {
    if (profil?.last_seen_version === CONFIG.appVersion) return;
    document.getElementById('modal-novinky-text').textContent = CONFIG.appChangelog;
    document.getElementById('modal-novinky').classList.remove('hidden');
  }

  function zavriModalNovinky() {
    document.getElementById('modal-novinky').classList.add('hidden');
    Auth.ulozVerziZobrazeni(CONFIG.appVersion);
    profil = { ...profil, last_seen_version: CONFIG.appVersion };
  }

  // ─── localStorage helpers ────────────────────────────────────
  function nactiProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem('matika_progress') || '{}');
      // Vyčisti AI-generované záznamy (gen_*) — průběžná sanitace starých dat
      let dirty = false;
      Object.keys(raw).forEach(temaId => {
        Object.keys(raw[temaId] || {}).forEach(id => {
          if (id.startsWith('gen_')) { delete raw[temaId][id]; dirty = true; }
        });
      });
      if (dirty) localStorage.setItem('matika_progress', JSON.stringify(raw));
      return raw;
    } catch { return {}; }
  }

  // Souhrnné výsledky po tématech — počítají i AI úlohy (ty jsou při přihlášení
  // skoro všechny). Statistiky z nich berou úspěšnost.
  function nactiVysledky() {
    try { return JSON.parse(localStorage.getItem(klicUzivatele(VYSLEDKY_KEY)) || '{}'); } catch { return {}; }
  }

  function zapisVysledek(temaId, uspech) {
    const v = nactiVysledky();
    const t = v[temaId] || { spravne: 0, celkem: 0 };
    t.celkem++;
    if (uspech) t.spravne++;
    v[temaId] = t;
    _zapisVysledky(v);
    Sync.zapisVysledek(temaId, uspech);
  }

  function _zapisVysledky(v) {
    try { localStorage.setItem(klicUzivatele(VYSLEDKY_KEY), JSON.stringify(v)); } catch {}
  }

  function ulozProgress(temaId, ulohaId, uspech) {
    zapisVysledek(temaId, uspech);

    // AI-generované příklady mají unikátní ID při každém generování —
    // do přehledu statických úloh je nezapisujeme.
    if (ulohaId.startsWith('gen_')) return;

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
        }, { onConflict: 'user_id,tema_id,uloha_id' })  // bez toho 2. řešení stejné úlohy narazí na UNIQUE
        .then(({ error }) => {
          if (error) console.warn('Progress sync selhal:', error.message);
        });
    }
  }


  // ─── Domovská obrazovka ───────────────────────────────────────
  function renderTemata() {
    // AI status badge
    const aiStav = document.getElementById('ai-stav');
    if (aiStav) {
      const aiOn = Api.jeAiDostupne();
      aiStav.textContent = aiOn ? '✨ AI kouč aktivní' : '📖 Statický mód';
      aiStav.className   = aiOn ? 'ai-stav ai-on' : 'ai-stav ai-off';
    }

    renderRozpracovane();

    const grid  = document.getElementById('temata-grid');
    const trida = profil?.trida || 8;
    grid.innerHTML = '';

    // Mix — dává smysl až od dvou odemčených témat
    if (odemcenaTemataProMix(trida).length >= 2) {
      grid.appendChild(vytvorKartuTematu(MIX_TEMA, { jeOdemceno: true, mix: true }));
    }

    TEMATA.forEach(tema => {
      const jeOdemceno = Syllabus.getUlohyProTridu(tema.id, trida).length > 0;
      grid.appendChild(vytvorKartuTematu(tema, {
        jeOdemceno,
        minTrida: !jeOdemceno ? Syllabus.getMinTrida(tema.id) : null
      }));
    });
  }

  function vytvorKartuTematu(tema, { jeOdemceno, minTrida = null, mix = false }) {
    const jeDnesHotovo   = jeOdemceno && SessionProgress.jeZamceno(tema.id);
    const klikatelna     = jeOdemceno && !jeDnesHotovo;
    const dokonceniCount = jeOdemceno ? SessionProgress.getDokonceniCount(tema.id) : 0;

    const karta = document.createElement('div');
    karta.className = 'tema-karta'
      + (mix ? ' tema-karta--mix' : '')
      + (!jeOdemceno ? ' tema-karta--zamcena' : jeDnesHotovo ? ' tema-karta--dnes-hotovo' : '');
    karta.style.setProperty('--tema-barva', TEMA_BARVY[tema.id] || 'var(--color-primary)');

    karta.setAttribute('role', klikatelna ? 'button' : 'article');
    if (klikatelna) karta.setAttribute('tabindex', '0');
    karta.setAttribute('aria-label',
      `Téma: ${tema.nazev}${!jeOdemceno ? ' (zamčeno)' : jeDnesHotovo ? ' (hotovo na dnes)' : ''}`);

    karta.innerHTML = `
      <div class="tema-ikona" aria-hidden="true">${tema.ikona}</div>
      <div class="tema-telo">
        ${mix ? '<span class="tema-stitek">Nové · trénink na test</span>' : ''}
        <h3 class="tema-nazev">${tema.nazev}</h3>
        <p class="tema-popis">${tema.popis}</p>
        ${!jeOdemceno   ? `<span class="tema-zamek" aria-hidden="true">🔒</span>` : ''}
        ${!jeOdemceno   ? `<p class="tema-zamceno-text">Dostupné od ${minTrida}. třídy</p>` : ''}
        ${jeDnesHotovo  ? `<span class="tema-zamek tema-zamek--hotovo" aria-hidden="true">✓</span>` : ''}
        ${jeDnesHotovo  ? `<p class="tema-zamceno-text">Hotovo na dnes · Odemkne se zítra</p>` : ''}
        ${jeOdemceno    ? `
        <div class="tema-cykly" aria-label="Dnes ${dokonceniCount} ze 3 cyklů">
          <span class="cyklus-puntik${dokonceniCount >= 1 ? ' hotovy' : ''}"></span>
          <span class="cyklus-puntik${dokonceniCount >= 2 ? ' hotovy' : ''}"></span>
          <span class="cyklus-puntik${dokonceniCount >= 3 ? ' hotovy' : ''}"></span>
          <span class="cykly-text">Dnes ${dokonceniCount}/3 · 5 příkladů</span>
        </div>` : ''}
      </div>
      ${klikatelna && TEMATA_S_VOLBOU_TYPU.includes(tema.id) ? prepinacTypuHtml(tema) : ''}
    `;

    if (klikatelna) {
      karta.addEventListener('click', () => spustTema(tema));
      karta.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spustTema(tema); }
      });
      napojPrepinacTypu(karta, tema);
    }
    return karta;
  }

  // Dvě tlačítka „Slovní úlohy / Jen příklady“ — zvolené je zvýrazněné
  function prepinacTypuHtml(tema) {
    const slovni = jeSlovniVolba(tema.id);
    return `
      <div class="typ-prepinac" role="group" aria-label="Typ úloh v tématu ${tema.nazev}">
        <button type="button" class="typ-volba${slovni ? ' typ-volba--aktivni' : ''}" data-slovni="1" aria-pressed="${slovni}">📝 Slovní úlohy</button>
        <button type="button" class="typ-volba${!slovni ? ' typ-volba--aktivni' : ''}" data-slovni="0" aria-pressed="${!slovni}">🔢 Jen příklady</button>
      </div>`;
  }

  function napojPrepinacTypu(karta, tema) {
    karta.querySelectorAll('.typ-volba').forEach(btn => {
      // Klik ani Enter na přepínači nesmí spustit sadu (karta je celá klikací)
      btn.addEventListener('keydown', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const slovni = btn.dataset.slovni === '1';
        nastavTypUloh(tema.id, slovni);
        karta.querySelectorAll('.typ-volba').forEach(b => {
          const aktivni = (b.dataset.slovni === '1') === slovni;
          b.classList.toggle('typ-volba--aktivni', aktivni);
          b.setAttribute('aria-pressed', String(aktivni));
        });
      });
    });
  }

  // ─── Panel „Rozpracované“ (home) ──────────────────────────────
  function renderRozpracovane() {
    const seznam  = document.getElementById('rozpracovane-seznam');
    const pocetEl = document.getElementById('rozpracovane-pocet');
    if (!seznam) return;

    const sady = Object.values(nactiRozpracovane())
      .filter(s => s.pokrok && s.ulohy?.length)
      .sort((a, b) => b.upraveno - a.upraveno);

    pocetEl.textContent = sady.length || '';
    pocetEl.classList.toggle('hidden', sady.length === 0);
    seznam.closest('.rozpracovane-panel')?.classList.toggle('rozpracovane-panel--prazdny', sady.length === 0);
    seznam.innerHTML = '';

    if (!sady.length) {
      seznam.innerHTML = `
        <div class="rozpracovane-prazdne">
          <span class="rozpracovane-prazdne-ikona" aria-hidden="true">📭</span>
          <p><strong>Zatím tu nic není.</strong></p>
          <p>Když od úlohy odejdeš tlačítkem „← Zpět“, uložíme ji sem a můžeš ji kdykoli dokončit.</p>
        </div>`;
      return;
    }
    sady.forEach(s => seznam.appendChild(vytvorPolozkuRozpracovane(s)));
  }

  function vytvorPolozkuRozpracovane(sada) {
    const celkem  = sada.ulohy.length;
    const cislo   = Math.min((sada.index ?? 0) + 1, celkem);
    const procent = Math.round(((sada.index ?? 0) / celkem) * 100);
    const zadani  = sada.ulohy[Math.min(sada.index ?? 0, celkem - 1)]?.zadani || '';

    const el = document.createElement('div');
    el.className = 'rozpracovana';
    el.style.setProperty('--tema-barva', TEMA_BARVY[sada.temaId] || 'var(--color-primary)');
    el.innerHTML = `
      <button type="button" class="rozpracovana-hlavni" aria-label="Pokračovat: ${escapujHtml(sada.nazev)}, úloha ${cislo} z ${celkem}">
        <span class="rozpracovana-ikona" aria-hidden="true">${sada.ikona || '📘'}</span>
        <span class="rozpracovana-telo">
          <span class="rozpracovana-nazev">${escapujHtml(sada.nazev)}</span>
          <span class="rozpracovana-zadani">${escapujHtml(zadani)}</span>
          <span class="rozpracovana-meta">
            <span class="rozpracovana-bar" aria-hidden="true"><span style="width:${procent}%"></span></span>
            Úloha ${cislo} z ${celkem} · ${kdyRelativne(sada.upraveno)}
          </span>
        </span>
      </button>
      <div class="rozpracovana-akce">
        <button type="button" class="btn-pokracovat">▶ Pokračovat</button>
        <button type="button" class="btn-kos" title="Smazat tuto sadu" aria-label="Smazat sadu ${escapujHtml(sada.nazev)}">🗑️ Smazat</button>
      </div>
      <div class="rozpracovana-potvrzeni hidden" role="alertdialog" aria-label="Potvrzení smazání">
        <span>Opravdu smazat? Rozdělaná práce se ztratí.</span>
        <div class="rozpracovana-potvrzeni-akce">
          <button type="button" class="btn-smazat-ano">Ano, smazat</button>
          <button type="button" class="btn-smazat-ne">Ne, nechat</button>
        </div>
      </div>
    `;
    MathRender.renderMath(el.querySelector('.rozpracovana-zadani'));

    const pokracuj = () => pokracujVSade(sada.sadaId);
    el.querySelector('.rozpracovana-hlavni').addEventListener('click', pokracuj);
    el.querySelector('.btn-pokracovat').addEventListener('click', pokracuj);

    const akce       = el.querySelector('.rozpracovana-akce');
    const potvrzeni  = el.querySelector('.rozpracovana-potvrzeni');
    el.querySelector('.btn-kos').addEventListener('click', () => {
      akce.classList.add('hidden');
      potvrzeni.classList.remove('hidden');
      potvrzeni.querySelector('.btn-smazat-ne').focus();
    });
    potvrzeni.querySelector('.btn-smazat-ne').addEventListener('click', () => {
      potvrzeni.classList.add('hidden');
      akce.classList.remove('hidden');
      el.querySelector('.btn-kos').focus();
    });
    potvrzeni.querySelector('.btn-smazat-ano').addEventListener('click', () => {
      el.classList.add('rozpracovana--mizi');
      setTimeout(() => { smazRozpracovanou(sada.sadaId); renderRozpracovane(); }, 200);
    });
    return el;
  }

  function kdyRelativne(cas) {
    const min = Math.round((Date.now() - cas) / 60000);
    if (min < 1)  return 'právě teď';
    if (min < 60) return `před ${min} min`;
    const hod = Math.round(min / 60);
    if (hod < 24) return `před ${hod} h`;
    const dny = Math.round(hod / 24);
    return dny === 1 ? 'včera' : `před ${dny} dny`;
  }

  // ─── Výběr úloh pro cyklus (bez opakování po dobu 30 dní) ───
  // Historie se ukládá do localStorage s timestampem; úloha se
  // nezobrazí dokud neuplyne COOLDOWN_MS od posledního zobrazení.
  function _nactiHistorii() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
    catch { return {}; }
  }

  function selectUlohyProCyklus(temaId, pool, pocet = TASKS_PER_CYCLE) {
    const now      = Date.now();
    const historie = _nactiHistorii();
    const tema     = historie[temaId] || {};

    // Stupeň 1: příklady nezobrazené v posledních 30 dnech
    let dostupne = pool.filter(u => {
      const t = tema[u.id];
      return !t || (now - t) > COOLDOWN_PRIMARY;
    });

    // Stupeň 2: příklady nezobrazené v posledních 7 dnech
    if (dostupne.length < pocet) {
      dostupne = pool.filter(u => {
        const t = tema[u.id];
        return !t || (now - t) > COOLDOWN_SECONDARY;
      });
    }

    // Stupeň 3: vezmi nejdéle nepoužívané (LRU) — jen krajní případ malého poolu
    if (dostupne.length < pocet) {
      dostupne = [...pool].sort((a, b) => (tema[a.id] || 0) - (tema[b.id] || 0));
    }

    // Fisher-Yates shuffle
    for (let i = dostupne.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dostupne[i], dostupne[j]] = [dostupne[j], dostupne[i]];
    }

    const vybrane = dostupne.slice(0, pocet);

    // Ulož timestamp zobrazení
    vybrane.forEach(u => { tema[u.id] = now; });
    historie[temaId] = tema;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historie));

    return vybrane;
  }

  // Pořadí témat pro Mix — co nejvíc různých, zamíchané
  function vyberTemataProMix(trida) {
    const temata = odemcenaTemataProMix(trida);
    for (let i = temata.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [temata[i], temata[j]] = [temata[j], temata[i]];
    }
    return Array.from({ length: TASKS_PER_CYCLE }, (_, i) => temata[i % temata.length]);
  }

  // Statický pool tématu, případně zúžený na zvolený typ úloh
  // (když daného typu není dost, vezme se celý pool — lepší než prázdná sada)
  function statickyPool(temaId, trida, slovni, pocet = TASKS_PER_CYCLE) {
    const pool  = Syllabus.getUlohyProTridu(temaId, trida);
    const zdroj = pool.length > 0 ? pool : (najdiTema(temaId)?.ulohy || []);
    if (!TEMATA_S_VOLBOU_TYPU.includes(temaId)) return zdroj;
    const zuzeny = zdroj.filter(u => jeSlovniUloha(u) === slovni);
    return zuzeny.length >= pocet ? zuzeny : zdroj;
  }

  // Statický výběr pro Mix — z každého vybraného tématu jedna úloha
  function selectUlohyProMix(temataMixu, typyMixu, trida) {
    return temataMixu.map((temaId, i) => {
      const [uloha] = selectUlohyProCyklus(temaId, statickyPool(temaId, trida, typyMixu[i], 1), 1);
      return uloha ? { ...uloha, temaId } : null;
    }).filter(Boolean);
  }

  // Místa, kde generátor nevytvořil ověřenou úlohu (null), doplní úlohami ze sbírky
  // stejného tématu a typu.
  function doplnZeSbirky(ulohy, temaProIndex, typProIndex, trida) {
    const chybi = {};
    ulohy.forEach((u, i) => {
      if (u) return;
      const klic = `${temaProIndex(i)}|${typProIndex(i)}`;
      (chybi[klic] ??= []).push(i);
    });
    Object.values(chybi).forEach(indexy => {
      const temaId = temaProIndex(indexy[0]);
      const pool   = statickyPool(temaId, trida, typProIndex(indexy[0]), indexy.length);
      const nahrada = selectUlohyProCyklus(temaId, pool, indexy.length);
      indexy.forEach((i, k) => { ulohy[i] = nahrada[k] ? { ...nahrada[k], temaId } : null; });
    });
    return ulohy.filter(Boolean);
  }

  // Připraví úlohy pro jeden cyklus: AI generování s ověřením, co neprojde,
  // doplní sbírka; při úplném selhání celý statický pool.
  async function pripravSadu(temaId, trida, onProgress) {
    const mix = temaId === MIX_TEMA.id;
    const temataMixu = mix ? vyberTemataProMix(trida) : null;
    // Mix střídá slovní úlohy a čisté příklady jako skutečný test; jinak platí volba na kartě
    const slovni = mix
      ? temataMixu.map(t => !TEMATA_S_VOLBOU_TYPU.includes(t) || Math.random() < 0.5)
      : jeSlovniVolba(temaId);

    if (Api.jeAiDostupne()) {
      try {
        const ulohy = await Generator.generujSadu(mix ? temataMixu : temaId, trida, TASKS_PER_CYCLE, onProgress, slovni);
        return doplnZeSbirky(
          ulohy,
          i => mix ? temataMixu[i] : temaId,
          i => mix ? slovni[i] : slovni,
          trida
        );
      } catch (err) {
        console.warn('Generator selhal, používám statický pool:', err.message);
      }
    }

    if (mix) return selectUlohyProMix(temataMixu, slovni, trida);
    return selectUlohyProCyklus(temaId, statickyPool(temaId, trida, slovni));
  }

  // ─── Loading overlay pro generování příkladů ─────────────────
  function zobrazNacitani(text) {
    const overlay = document.getElementById('generovani-overlay');
    if (text) {
      document.getElementById('generovani-text').textContent = text;
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  // ─── Spuštění tématu ──────────────────────────────────────────
  async function spustTema(tema) {
    if (_spustTemaBeziPro) return;   // dvojklik nebo souběžné volání → ignoruj
    _spustTemaBeziPro = true;
    try {
      await _spustTemaImpl(tema);
    } finally {
      _spustTemaBeziPro = false;
    }
  }

  async function _spustTemaImpl(tema) {
    // Klik na téma vždy spustí NOVOU sadu — k rozdělaným se žák vrací
    // z panelu „Rozpracované“ (pokracujVSade).
    const temaId = tema._temaId || tema.id;
    const trida  = profil?.trida || 8;

    // Cycle se počítá při DOKONČENÍ sady (ne při spuštění) — jen zkontroluj zámek
    if (SessionProgress.jeZamceno(temaId)) {
      zobrazDomovskou();
      zobrazModalDnesHotovo();
      return;
    }

    // ── AI generování (se statickým fallbackem) ───────────────
    let vybrane;

    if (Api.jeAiDostupne()) {
      // Nastav aktualniTema ihned s prázdnými úlohami — Zpět tak zachytí správné temaId
      // i když generování ještě neskončilo.
      aktualniTema       = { ...tema, ulohy: [] };
      aktualniUlohaIndex = 0;
      skore              = { spravne: 0, celkem: 0 };

      vycistiObrazovkuUlohy();  // ať pod načítáním nezůstane konverzace z minulé sady
      zobrazUlohu();
      document.getElementById('uloha-tema-nazev').textContent = tema.nazev;
      zobrazNacitani('Připravuji nové příklady…');

      vybrane = await pripravSadu(temaId, trida, (n, z, faze) => {
        zobrazNacitani(faze === 'overeni'
          ? 'Kontroluji, že jsou výsledky správně…'
          : `Připravuji příklady… ${n}/${z}`);
      });

      zobrazNacitani(null);

      // Uživatel přešel jinam během generování → tiše storno, žádný cyklus se nezapočítá
      if (document.getElementById('screen-uloha').classList.contains('hidden')) return;
    } else {
      vybrane = await pripravSadu(temaId, trida);
    }

    uklidNedotceneSady();
    aktualniTema       = { ...tema, ulohy: vybrane, sadaId: novaSadaId() };
    aktualniUlohaIndex = 0;
    skore              = { spravne: 0, celkem: vybrane.length };
    dialogLog          = [];
    _sadaZapoctena     = false;
    _posledniDokoncena = false;
    zobrazUlohu();
    document.getElementById('uloha-tema-nazev').textContent = tema.nazev;
    if (Api.jeLimitVycerpan() && Auth.jeAuthenticated()) {
      aktualniTema._limitOznamen = true;
      nactiUlohu(0, TEXT_LIMIT);
    } else {
      nactiUlohu(0);
    }
  }

  // ─── Pokračování v rozpracované sadě (z panelu na home) ───────
  async function pokracujVSade(sadaId) {
    const sada = nactiRozpracovane()[sadaId];
    if (!sada?.ulohy?.length) { renderRozpracovane(); return; }

    const tema  = najdiTema(sada.temaId) || { id: sada.temaId, nazev: sada.nazev, ikona: sada.ikona };
    const ulohy = sada.ulohy.map(u => ({ ...u, kontrola: _rekonstruujKontrola(u) }));

    aktualniTema       = { ...tema, ulohy, sadaId };
    aktualniUlohaIndex = Math.min(sada.index ?? 0, ulohy.length);
    skore              = { ...(sada.skore || { spravne: 0, celkem: ulohy.length }) };
    dialogLog          = [];
    _sadaZapoctena     = false;
    _posledniDokoncena = false;
    zobrazUlohu();
    document.getElementById('uloha-tema-nazev').textContent = aktualniTema.nazev;
    await nactiUlohu(aktualniUlohaIndex);
  }

  // ─── Dokončení celé sady ──────────────────────────────────────
  // Volá se z nactiUlohu() když index překročí délku sady.
  async function dokonceniSady() {
    if (_sadaSeKonci) return;  // dvojklik na "Další" nebo race → ignoruj
    _sadaSeKonci = true;
    try {
      await _dokonceniSadyImpl();
    } finally {
      _sadaSeKonci = false;
    }
  }

  async function _dokonceniSadyImpl() {
    smazRozpracovanou(aktualniTema.sadaId);  // sada je hotová — z panelu „Rozpracované“ zmizí
    const temaId = aktualniTema._temaId || aktualniTema.id;
    const vysledekSady = `Sada hotová: ${skore.spravne} z ${skore.celkem} správně.`;
    const userId = Auth.getSession()?.user?.id;

    // Zaregistruj dokončení tohoto cyklu — count++ se děje TEĎ (ne při startu)
    const { count, zamceno } = await SessionProgress.spustiSadu(temaId, userId);
    _sadaZapoctena = true;  // zabraňuje dvojímu počítání při odchodu zpět

    if (zamceno || count >= 3) {
      // Třetí cyklus dokončen → uzamkni do půlnoci
      await SessionProgress.uzamkniSadu(temaId, userId);
      zobrazDomovskou();
      zobrazModalDnesHotovo(vysledekSady);
      return;
    }

    const zbyvaPocet = 3 - count;
    const trida      = profil?.trida || 8;

    // Reset flagů pro nový cyklus
    _sadaZapoctena     = false;
    _posledniDokoncena = false;

    vycistiObrazovkuUlohy();
    if (Api.jeAiDostupne()) zobrazNacitani('Připravuji další příklady…');
    const vybrane = await pripravSadu(temaId, trida);
    zobrazNacitani(null);

    aktualniTema = { ...aktualniTema, ulohy: vybrane, sadaId: novaSadaId() };
    skore        = { spravne: 0, celkem: vybrane.length };
    dialogLog    = [];

    zobrazUlohu();
    document.getElementById('uloha-tema-nazev').textContent = aktualniTema.nazev;
    const introText = `🎉 ${vysledekSady}` + (zbyvaPocet === 0
      ? ' Tohle je tvoje poslední sada na dnes.'
      : ` Můžeš dát ještě ${zbyvaPocet}× — tady je další sada.`);
    nactiUlohu(0, introText);
  }

  // ─── Modal "Skvělá práce na dnes!" ────────────────────────────
  function zobrazModalDnesHotovo(vysledekSady = '') {
    const el = document.getElementById('modal-hotovo-vysledek');
    el.textContent = vysledekSady;
    el.classList.toggle('hidden', !vysledekSady);
    document.getElementById('modal-dnes-hotovo').classList.remove('hidden');
  }

  function zavriModalDnesHotovo() {
    document.getElementById('modal-dnes-hotovo').classList.add('hidden');
  }

  // ─── Načtení úlohy (async) ────────────────────────────────────
  // introZprava — volitelná zpráva zobrazená před zadáním první úlohy (po restartu sady)
  async function nactiUlohu(index, introZprava = null) {
    if (index >= aktualniTema.ulohy.length) {
      await dokonceniSady();
      return;
    }
    aktualniUlohaIndex = index;
    ulozRozpracovanou();  // přežije hard refresh i zavření prohlížeče
    const uloha = aktualniTema.ulohy[index];
    dialogLog = [];

    // Progress bar — ukazuje (index+1)/celkem, tj. 100 % na poslední úloze
    const procent = Math.round(((index + 1) / aktualniTema.ulohy.length) * 100);
    document.getElementById('uloha-progress-fill').style.width = procent + '%';
    document.getElementById('uloha-progress-text').textContent =
      `Úloha ${index + 1} z ${aktualniTema.ulohy.length}`;

    // Kontext žáka pro engine
    const kontextZaka = profil ? {
      trida:          profil.trida,
      odemcenaTemata: odemcenaTemata || TEMATA.map(t => t.id)
    } : null;

    // Vyčisti dialog; vzorový postup dostane placeholder (zobrazí se po dokončení)
    document.getElementById('dialog-log').innerHTML = '';
    document.getElementById('btn-dalsi').classList.add('hidden');
    zobrazPlaceholderPostupu();

    // Zkus obnovit uloženou konverzaci pro tuto úlohu
    const temaId  = aktualniTema._temaId || aktualniTema.id;
    const ulozena = obnovKonverzaci(aktualniTema.sadaId, uloha.id);

    if (ulozena?.engineStav && (ulozena.dialogLog?.length > 0 || ulozena.engineStav.faze === 'zacatek')) {
      // ── Obnova uložené konverzace ─────────────────────────────
      Engine.obnovStav(ulozena.engineStav, uloha);
      renderZadani();
      renderPlan();

      (ulozena.dialogLog || []).forEach(m => {
        if (m.typ === 'system') return;  // starší formát — zadání je teď v kartě nad dialogem
        dialogLog.push(m);
        _renderZprava(m.typ, m.text);
      });

      pridejZpravu('info', '↩ Pokračuješ v rozpracované úloze.');

      if (Engine.jeDokonceno())                        dokoncUlohu();
      else if (Engine.getStav().faze === 'zacatek')    zobrazVolbuZacatku();
      else                                             povolVstup();
      return;
    }

    // ── Normální inicializace ─────────────────────────────────────
    Engine.inicializuj(uloha, kontextZaka, uloha.temaId || temaId);
    renderZadani();
    renderPlan();
    setVstupDisabled(true);

    pokazLoadingIndikator();
    const prep = await Engine.priprav();
    skrejLoadingIndikator();

    // Mezitím se otevřela jiná úloha (Zpět + jiné téma) → výsledek zahoď
    if (Engine.getStav().uloha !== uloha) return;

    if (prep.error) zobrazApiChybu(prep.error);
    if (introZprava) pridejZpravu('info', introZprava);
    renderPlan();

    if (prep.zacatek) {
      zobrazVolbuZacatku();
    } else {
      pridejZpravu('hint', prep.uvod);
      povolVstup();
    }
    ulozKonverzaci();
  }

  // Vyprázdní zadání, dialog, plán i postup (před načtením nové sady)
  function vycistiObrazovkuUlohy() {
    dialogLog = [];
    document.getElementById('dialog-log').innerHTML = '';
    document.getElementById('zadani-text').innerHTML = '';
    document.getElementById('plan-list').innerHTML = '';
    document.getElementById('btn-dalsi').classList.add('hidden');
    document.getElementById('vstup-pole').value = '';
    setVstupDisabled(true);
    zobrazPlaceholderPostupu();
  }

  function povolVstup() {
    setVstupDisabled(false);
    const pole = document.getElementById('vstup-pole');
    pole.value = '';
    pole.focus();
  }

  // ─── Zadání se zvýrazněním ────────────────────────────────────
  function renderZadani() {
    const { uloha, zvyraznit } = Engine.getStav();
    const el = document.getElementById('zadani-text');
    if (!uloha) { el.innerHTML = ''; return; }
    el.innerHTML = zvyrazniText(uloha.zadani, zvyraznit);
    MathRender.renderMath(el);
    document.getElementById('zadani-karta')
      .classList.toggle('zadani-karta--zvyraznena', el.querySelector('mark') !== null);
  }

  // Obalí úryvky (bez ohledu na velikost písmen) do <mark>. Vrací HTML.
  // LaTeX ($...$) se zvýrazní celý, pokud ho kouč v úryvku uvedl.
  function zvyrazniText(text, useky = []) {
    const LATEX_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
    const textoveUseky = useky
      .flatMap(u => u.split(/\$[^$]*\$/))
      .map(u => u.trim().toLowerCase())
      .filter(u => u.length >= 3);
    const latexUseky = useky.flatMap(u => u.match(/\$[^$]+\$/g) || []).map(u => u.toLowerCase());

    return text.split(LATEX_RE).map((cast, i) => {
      if (i % 2 === 1) {
        return latexUseky.includes(cast.toLowerCase())
          ? `<mark class="zvyrazneni">${escapujHtml(cast)}</mark>`
          : escapujHtml(cast);
      }

      const lower   = cast.toLowerCase();
      const rozsahy = [];
      textoveUseky.forEach(u => {
        for (let idx = lower.indexOf(u); idx !== -1; idx = lower.indexOf(u, idx + u.length)) {
          rozsahy.push([idx, idx + u.length]);
        }
      });
      if (!rozsahy.length) return escapujHtml(cast);

      // Sloučení překrývajících se rozsahů
      rozsahy.sort((a, b) => a[0] - b[0]);
      const slouceno = [rozsahy[0]];
      rozsahy.slice(1).forEach(([od, do_]) => {
        const posledni = slouceno[slouceno.length - 1];
        if (od <= posledni[1]) posledni[1] = Math.max(posledni[1], do_);
        else slouceno.push([od, do_]);
      });

      let html = '';
      let pozice = 0;
      slouceno.forEach(([od, do_]) => {
        html += escapujHtml(cast.slice(pozice, od));
        html += `<mark class="zvyrazneni">${escapujHtml(cast.slice(od, do_))}</mark>`;
        pozice = do_;
      });
      return html + escapujHtml(cast.slice(pozice));
    }).join('');
  }

  // ─── Plán řešení (pravý panel) ────────────────────────────────
  function renderPlan() {
    const { plan, aktivniKrok, dokonceno, zobrazenaOdpoved, faze } = Engine.getStav();
    const el = document.getElementById('plan-list');
    if (!plan?.length) {
      el.innerHTML = '<li class="plan-krok plan-krok--placeholder">Připravuji plán…</li>';
      return;
    }
    el.innerHTML = plan.map((nazev, i) => {
      const cislo = i + 1;
      const stavKroku = (dokonceno && !zobrazenaOdpoved) || cislo < aktivniKrok ? 'hotovo'
                      : (!dokonceno && faze === 'reseni' && cislo === aktivniKrok) ? 'aktivni'
                      : 'ceka';
      return `
        <li class="plan-krok plan-krok--${stavKroku}"${stavKroku === 'aktivni' ? ' aria-current="step"' : ''}>
          <span class="plan-cislo" aria-hidden="true">${stavKroku === 'hotovo' ? '✓' : cislo}</span>
          <span class="plan-nazev">${escapujHtml(nazev)}</span>
        </li>`;
    }).join('');
    MathRender.renderMath(el);
  }

  // ─── „Jak začneš?“ — volba prvního kroku ──────────────────────
  function zobrazVolbuZacatku() {
    const { zacatek, zacatekChyby } = Engine.getStav();
    if (!zacatek) return;
    setVstupDisabled(true);

    const logEl = document.getElementById('dialog-log');
    const karta = document.createElement('div');
    karta.className = 'volba-karta';
    karta.innerHTML = `
      <span class="volba-label">Než začneš počítat</span>
      <p class="volba-otazka">Jak tuhle úlohu začneš?</p>
      <div class="volba-moznosti" role="group" aria-label="Možnosti prvního kroku"></div>
      <p class="volba-zpetna-vazba hidden" aria-live="polite"></p>
    `;

    const moznostiEl = karta.querySelector('.volba-moznosti');
    zacatek.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'volba-moznost';
      btn.innerHTML = `<span class="volba-pismeno" aria-hidden="true">${'ABCD'[i]}</span><span class="volba-text">${escapujHtml(m.text)}</span>`;
      if (zacatekChyby.includes(i)) {
        btn.classList.add('volba-moznost--spatne');
        btn.disabled = true;
      }
      btn.addEventListener('click', () => zvolZacatek(i, karta));
      moznostiEl.appendChild(btn);
    });

    logEl.appendChild(karta);
    MathRender.renderMath(karta);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function zvolZacatek(index, karta) {
    const vysledek = Engine.vyberZacatek(index);
    if (!vysledek) return;
    const tlacitka    = karta.querySelectorAll('.volba-moznost');
    const zpetnaVazba = karta.querySelector('.volba-zpetna-vazba');

    if (!vysledek.spravne) {
      tlacitka[index].classList.add('volba-moznost--spatne');
      tlacitka[index].disabled = true;
      zpetnaVazba.innerHTML = `<strong>Tudy ne.</strong> ${escapujHtml(vysledek.proc)} Zkus jinou možnost.`;
      zpetnaVazba.classList.remove('hidden');
      MathRender.renderMath(zpetnaVazba);
      ulozKonverzaci();
      return;
    }

    tlacitka[index].classList.add('volba-moznost--spravne');
    tlacitka.forEach(b => { b.disabled = true; });
    karta.classList.add('volba-karta--hotovo');
    zpetnaVazba.classList.add('hidden');

    pridejZpravu('volba', vysledek.text);
    pridejZpravu('pokrok', vysledek.zprava);
    renderPlan();
    ulozKonverzaci();
    povolVstup();
  }

  // ─── Typy zpráv v dialogu ─────────────────────────────────────
  const MSG_IKONY = {
    system: '📋', student: '✏️', volba: '🧭', hint: '💡', pokrok: '👍', uspech: '✅',
    reseni: '📖', chyba: '⚠️', info: 'ℹ️', apierror: '🔌'
  };
  const MSG_LABELY = {
    system: 'Zadání', student: 'Ty', volba: 'Začnu tím, že', hint: 'Kouč', pokrok: 'Kouč · dobrý krok',
    uspech: 'Správně', reseni: 'Řešení', chyba: 'Upozornění', info: 'Info', apierror: 'Chyba API'
  };

  function _vytvorZpravu(typ, text) {
    const msg = document.createElement('div');
    msg.className = `msg msg-${typ}`;
    msg.innerHTML = `
      <span class="msg-ikona" aria-hidden="true">${MSG_IKONY[typ] || '•'}</span>
      <div class="msg-obsah">
        <span class="msg-label">${MSG_LABELY[typ] || typ}</span>
        <p class="msg-text math-text">${escapujHtml(text)}</p>
      </div>
    `;
    return msg;
  }

  // Renderuje zprávu do DOM bez přidání do dialogLog (pro obnovu uložené konverzace)
  function _renderZprava(typ, text) {
    const logEl = document.getElementById('dialog-log');
    const msg   = _vytvorZpravu(typ, text);
    msg.classList.add('msg-visible');
    logEl.appendChild(msg);
    MathRender.renderMath(msg);
    logEl.scrollTop = logEl.scrollHeight;
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
        <span class="msg-label">Kouč přemýšlí…</span>
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
    document.getElementById('btn-napoveda').disabled = disabled;
  }

  // ─── Dialog ──────────────────────────────────────────────────
  function pridejZpravu(typ, text) {
    dialogLog.push({ typ, text });
    const logEl = document.getElementById('dialog-log');
    const msg   = _vytvorZpravu(typ, text);
    logEl.appendChild(msg);
    requestAnimationFrame(() => {
      msg.classList.add('msg-visible');
      MathRender.renderMath(msg); // KaTeX rendering
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  function zobrazApiChybu(chyba) {
    if (Api.jeLimitVycerpan()) { zobrazInfoOLimitu(); return; }
    pridejZpravu('apierror', `Nepodařilo se připojit k AI (${chyba}). Pokračuji se statickými nápovědami.`);
  }

  // Hláška o vyčerpaném denním limitu — v jedné sadě jen jednou
  function zobrazInfoOLimitu() {
    if (aktualniTema?._limitOznamen) return;
    if (aktualniTema) aktualniTema._limitOznamen = true;
    pridejZpravu('info', TEXT_LIMIT);
  }
  const TEXT_LIMIT = 'Na dnešek je AI kouč vyčerpaný. Dál ti pomůžu připravenými nápovědami a úlohami ze sbírky, zítra je kouč zase k dispozici.';

  function escapujHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\{,\}/g, ',')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // kouč zvýrazňuje klíčové pojmy
      .replace(/\n/g, '<br>');
  }

  // ─── Vzorový postup (pravý panel) ─────────────────────────────

  // Placeholder během řešení (postup se zobrazí po dokončení)
  function zobrazPlaceholderPostupu() {
    const log = document.getElementById('vypocet-log');
    if (!log) return;
    log.innerHTML = '<div class="vypocet-placeholder">Vzorový postup se ukáže, až příklad dokončíš.</div>';
  }

  // Přidá jeden krok (LaTeX + popis) do výpočetního panelu.
  // krok = { latex, popis?, stav } z postup[] dané úlohy
  // cssTyp = 'krok' | 'vysledek'
  function pridejKrokDoVypoctu(krok, cssTyp) {
    const log = document.getElementById('vypocet-log');
    const el  = document.createElement('div');
    const typ = krok.stav === 'vysledek' ? 'vysledek' : cssTyp;
    el.className = `vypocet-krok vypocet-krok--${typ}`;

    if (krok.popis) {
      const popisEl = document.createElement('p');
      popisEl.className = 'krok-popis';
      popisEl.textContent = (krok.popis || '').replace(/\{,\}/g, ',');  // textContent → $ v textu zpracuje renderMath níže
      el.appendChild(popisEl);
    }

    // Odstraň případné $ které AI přidala, pak přidej $ pro renderMath — stejný přístup
    // jako v dialog nápovědách (textContent + renderMath, bez double-rendering přes renderStep).
    const latexEl = document.createElement('div');
    latexEl.className = 'krok-latex';
    const latex = (krok.latex || '').replace(/^\$+|\$+$/g, '').trim();
    if (latex) latexEl.textContent = `$${latex}$`;
    el.appendChild(latexEl);

    log.appendChild(el);
    MathRender.renderMath(el);  // jeden průchod, zpracuje popis i latex
    log.scrollTop = log.scrollHeight;
  }

  // Zobrazí celý postup po dokončení příkladu (správná odpověď nebo řešení).
  // Postup se zobrazí vždy — buď LaTeX kroky z postup[], nebo textové nápovědy z kroky[].
  function zobrazPostupPoDokonceni() {
    const uloha = aktualniTema?.ulohy?.[aktualniUlohaIndex];
    const log   = document.getElementById('vypocet-log');
    if (!log) return;
    log.innerHTML = '';

    if (!uloha) return;

    if (uloha.postup?.length > 0) {
      uloha.postup.forEach(krok => pridejKrokDoVypoctu(krok, 'krok'));
    } else if (uloha.kroky?.length > 0) {
      // Fallback pro statické příklady bez LaTeX postupu
      uloha.kroky.forEach(k => {
        const el = document.createElement('div');
        el.className = 'vypocet-krok vypocet-krok--krok vypocet-krok--text';
        el.textContent = k;
        log.appendChild(el);
        MathRender.renderMath(el);
      });
    } else {
      log.innerHTML = '<div class="vypocet-placeholder">Postup řešení není k dispozici.</div>';
    }

    log.scrollTop = 0;
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

    const uloha       = aktualniTema.ulohy[aktualniUlohaIndex];
    const temaUlohy   = uloha.temaId || aktualniTema._temaId || aktualniTema.id;

    if (vysledek.typ === 'napoveda') {
      pridejZpravu(vysledek.pokrok ? 'pokrok' : 'hint', vysledek.text);
      renderZadani();
      renderPlan();
      ulozKonverzaci();
      setVstupDisabled(false);
      document.getElementById('vstup-pole').focus();
    } else if (vysledek.typ === 'uspech') {
      pridejZpravu('uspech', vysledek.text);
      ulozProgress(temaUlohy, uloha.id, true);
      skore.spravne++;
      dokoncUlohu();
    } else if (vysledek.typ === 'reseni') {
      pridejZpravu('reseni', vysledek.text);
      ulozProgress(temaUlohy, uloha.id, false);
      dokoncUlohu();
    } else if (vysledek.typ === 'info') {
      pridejZpravu('info', vysledek.text);
      setVstupDisabled(false);
    }
  }

  // ─── Tlačítko „Nevím, jak dál“ ────────────────────────────────
  async function pozadejNapovedu() {
    if (cekaNaApi || Engine.jeDokonceno() || Engine.getStav().faze !== 'reseni') return;

    pokazLoadingIndikator();
    const vysledek = await Engine.napoveda();
    skrejLoadingIndikator();

    if (vysledek) {
      if (vysledek.fallback && vysledek.error) zobrazApiChybu(vysledek.error);
      pridejZpravu('hint', vysledek.text);
      renderZadani();
      renderPlan();
      ulozKonverzaci();
    }
    // Rozepsanou odpověď v poli necháváme — žák v ní může pokračovat
    setVstupDisabled(false);
    document.getElementById('vstup-pole').focus();
  }

  function dokoncUlohu() {
    setVstupDisabled(true);

    const uloha = aktualniTema.ulohy[aktualniUlohaIndex];
    if (uloha) smazKonverzaci(aktualniTema.sadaId, uloha.id);
    ulozRozpracovanou({ pokrok: true });  // pozice se posune na další úlohu

    // Zvýraznění už nedává smysl; plán odškrtni a ukaž vzorový postup
    renderZadani();
    renderPlan();
    zobrazPostupPoDokonceni();

    const btnDalsi   = document.getElementById('btn-dalsi');
    btnDalsi.classList.remove('hidden');
    const jePosledni = aktualniUlohaIndex >= aktualniTema.ulohy.length - 1;
    btnDalsi.textContent = jePosledni ? 'Ukončit sadu' : 'Další úloha →';
    if (jePosledni) _posledniDokoncena = true;
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

  // ─── Dark mode ────────────────────────────────────────────────
  function initDarkMode() {
    const ulozene   = localStorage.getItem('matika_darkmode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark      = ulozene !== null ? ulozene === '1' : prefersDark;
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Chybové hlášky Supabase jsou anglicky — přeložíme ty, na které žák narazí
  function prelozChybuAuth(e, vychozi = 'Něco se nepovedlo, zkus to prosím znovu.') {
    const m = String(e?.message || '');
    if (/invalid login credentials/i.test(m))              return 'Špatný e-mail nebo heslo. Pokud heslo nevíš, klikni na „Zapomněl/a jsi heslo?“.';
    if (/email not confirmed/i.test(m))                    return 'Nejdřív potvrď e-mail — klikni na odkaz, který ti přišel po registraci.';
    if (/already registered|already been registered/i.test(m)) return 'Účet s tímhle e-mailem už existuje. Přihlas se, nebo si nech poslat nové heslo.';
    if (/rate limit|after \d+ seconds|security purposes/i.test(m)) return 'Teď jsme ti už jeden e-mail poslali. Další jde poslat zhruba za minutu.';
    if (/different from the old/i.test(m))                 return 'Nové heslo musí být jiné než to původní.';
    if (/password should|weak password|at least \d+ char/i.test(m)) return 'Heslo je moc slabé — použij aspoň 8 znaků, ideálně písmena i čísla.';
    if (/invalid email|unable to validate email/i.test(m)) return 'Tenhle e-mail nevypadá správně.';
    if (/session missing|not logged in|jwt expired/i.test(m)) return 'Odkaz už vypršel. Požádej o nový přes „Zapomněl/a jsi heslo?“.';
    return vychozi;
  }

  function zobrazModalNoveHeslo() {
    document.getElementById('nove-heslo').value = '';
    document.getElementById('nove-heslo-znovu').value = '';
    document.getElementById('nove-heslo-chyba').classList.add('hidden');
    document.getElementById('nove-heslo-formular').classList.remove('hidden');
    document.getElementById('nove-heslo-hotovo').classList.add('hidden');
    document.getElementById('modal-nove-heslo').classList.remove('hidden');
    setTimeout(() => document.getElementById('nove-heslo').focus(), 50);
  }

  // Odkaz z e-mailu (obnova hesla, potvrzení registrace) — co v něm přišlo.
  // Čteme ho před Auth.init(), protože Supabase adresu po zpracování vyčistí.
  function prectiOdkazZEmailu() {
    const hash  = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    const chyba = hash.get('error_code') || hash.get('error') || query.get('error_code') || query.get('error');
    return { obnova: hash.get('type') === 'recovery', chyba };
  }

  function uklidOdkazZEmailu() {
    const query = new URLSearchParams(location.search);
    ['error', 'error_code', 'error_description'].forEach(k => query.delete(k));
    const q = query.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
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
        document.getElementById('auth-reset').classList.add('hidden');
      });
    });

    // Zapomenuté heslo
    const zobrazReset = (zobrazit) => {
      document.getElementById('auth-login').classList.toggle('hidden', zobrazit);
      document.getElementById('auth-reset').classList.toggle('hidden', !zobrazit);
      if (zobrazit) {
        const email = document.getElementById('auth-email').value.trim();
        if (email) document.getElementById('reset-email').value = email;
        document.getElementById('reset-zprava').classList.add('hidden');
        document.getElementById('reset-email').focus();
      }
    };
    document.getElementById('btn-zapomenute-heslo').addEventListener('click', () => zobrazReset(true));
    document.getElementById('btn-reset-zpet').addEventListener('click', () => zobrazReset(false));

    document.getElementById('btn-poslat-reset').addEventListener('click', async () => {
      const email  = document.getElementById('reset-email').value.trim();
      const btn    = document.getElementById('btn-poslat-reset');
      const zprava = document.getElementById('reset-zprava');
      const ukaz = (text, ok) => {
        zprava.textContent = text;
        zprava.classList.toggle('zprava-ok', ok);
        zprava.classList.remove('hidden');
      };
      if (!/^\S+@\S+\.\S+$/.test(email)) { ukaz('Napiš celý e-mail, např. jmeno@seznam.cz.', false); return; }
      btn.disabled = true;
      try {
        await Auth.posliObnovuHesla(email);
        // Neprozrazujeme, jestli účet existuje
        ukaz('Hotovo! Pokud k tomuhle e-mailu máme účet, za chvíli ti přijde odkaz pro nastavení nového hesla. Když ho nevidíš, mrkni i do spamu.', true);
      } catch (e) {
        ukaz(prelozChybuAuth(e), false);
      } finally {
        btn.disabled = false;
      }
    });
    document.getElementById('reset-email').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-poslat-reset').click();
    });

    // Nové heslo (po kliknutí na odkaz z e-mailu)
    document.getElementById('btn-ulozit-heslo').addEventListener('click', async () => {
      const heslo  = document.getElementById('nove-heslo').value;
      const znovu  = document.getElementById('nove-heslo-znovu').value;
      const chybaEl = document.getElementById('nove-heslo-chyba');
      const ukazChybu = text => { chybaEl.textContent = text; chybaEl.classList.remove('hidden'); };
      chybaEl.classList.add('hidden');
      if (heslo.length < 8)  { ukazChybu('Heslo musí mít aspoň 8 znaků.'); return; }
      if (heslo !== znovu)   { ukazChybu('Hesla se neshodují — napiš obě stejně.'); return; }
      const btn = document.getElementById('btn-ulozit-heslo');
      btn.disabled = true;
      try {
        await Auth.zmenHeslo(heslo);
        document.getElementById('nove-heslo-formular').classList.add('hidden');
        document.getElementById('nove-heslo-hotovo').classList.remove('hidden');
      } catch (e) {
        ukazChybu(prelozChybuAuth(e));
      } finally {
        btn.disabled = false;
      }
    });
    document.getElementById('nove-heslo-znovu').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-ulozit-heslo').click();
    });
    const zavriNoveHeslo = () => document.getElementById('modal-nove-heslo').classList.add('hidden');
    document.getElementById('btn-heslo-pozdeji').addEventListener('click', zavriNoveHeslo);
    document.getElementById('btn-heslo-hotovo').addEventListener('click', zavriNoveHeslo);

    // Přihlášení
    document.getElementById('btn-prihlasit').addEventListener('click', async () => {
      const email    = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const chybaEl  = document.getElementById('auth-chyba');
      chybaEl.classList.add('hidden');
      try {
        const zapamatovat = document.getElementById('auth-zapamatovat').checked;
        await Auth.prihlasuj(email, password);
        // „Nezůstat přihlášen“: token přežije F5, ale ne zavření tabu
        if (!zapamatovat) Auth.nezapamatovatPrihlaseni();
        // onAuthStateChange SIGNED_IN → pokracujPoLoginu() volá se přes callback
      } catch (e) {
        chybaEl.textContent = prelozChybuAuth(e, e.message);
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
    const chkGdpr   = document.getElementById('chk-gdpr-souhlas');
    const btnReg    = document.getElementById('btn-registrovat');
    chkGdpr.addEventListener('change', () => { btnReg.disabled = !chkGdpr.checked; });

    btnReg.addEventListener('click', async () => {
      if (!chkGdpr.checked) return;
      const email    = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const chybaEl  = document.getElementById('reg-chyba');
      chybaEl.classList.add('hidden');
      try {
        await Auth.registruj(email, password);
        chybaEl.style.color = 'var(--color-success)';
        chybaEl.textContent = '✅ Účet vytvořen! Zkontroluj e-mail a klikni na potvrzovací odkaz.';
        chybaEl.classList.remove('hidden');
      } catch (e) {
        chybaEl.style.color = '';
        chybaEl.textContent = prelozChybuAuth(e, e.message);
        chybaEl.classList.remove('hidden');
      }
    });

    // Odhlášení
    document.getElementById('btn-logout').addEventListener('click', async () => {
      zavriDropdown();
      vycistiLocalStorage();
      await Auth.odhlas();
      profil         = null;
      odemcenaTemata = null;
      SessionProgress.resetCache();
      document.getElementById('user-dropdown-wrap').classList.add('hidden');
      // onAuthStateChange SIGNED_OUT → zobrazAuthScreen()
    });
  }

  // ─── Nahlášení chyby v úloze ──────────────────────────────────
  function initNahlaseniChyby() {
    const modal   = document.getElementById('modal-nahlasit');
    const btnOdes = document.getElementById('btn-nahlasit-odeslat');
    const chybaEl = document.getElementById('nahlasit-chyba');
    const zavri   = () => modal.classList.add('hidden');

    document.getElementById('btn-nahlasit-chybu')?.addEventListener('click', () => {
      if (!aktualniTema?.ulohy?.[aktualniUlohaIndex]) return;
      modal.querySelectorAll('input[name="nahlasit-duvod"]').forEach(r => { r.checked = false; });
      document.getElementById('nahlasit-popis').value = '';
      chybaEl.classList.add('hidden');
      btnOdes.disabled = true;
      document.getElementById('nahlasit-formular').classList.remove('hidden');
      document.getElementById('nahlasit-hotovo').classList.add('hidden');
      modal.classList.remove('hidden');
    });

    modal.addEventListener('change', e => {
      if (e.target.name === 'nahlasit-duvod') btnOdes.disabled = false;
    });

    btnOdes.addEventListener('click', async () => {
      const duvod = modal.querySelector('input[name="nahlasit-duvod"]:checked')?.value;
      const uloha = aktualniTema?.ulohy?.[aktualniUlohaIndex];
      if (!duvod || !uloha) return;
      const temaId = uloha.temaId || aktualniTema._temaId || aktualniTema.id;
      btnOdes.disabled = true;
      chybaEl.classList.add('hidden');
      try {
        await Auth.nahlasChybu({
          duvod,
          popis:    document.getElementById('nahlasit-popis').value.trim().slice(0, 1000) || null,
          tema_id:  temaId,
          uloha_id: uloha.id,
          uloha: {
            zadani:   uloha.zadani,
            odpoved:  uloha.odpoved,
            jednotka: uloha.jednotka || '',
            postup:   uloha.postup || [],
            plan:     Engine.getStav().plan || [],
            kontrola: uloha._meta || null,
            slovni:   uloha.slovni ?? null,
            trida:    profil?.trida ?? null
          },
          konverzace: dialogLog.slice(-12).map(m => ({ typ: m.typ, text: String(m.text ?? '').slice(0, 1500) })),
          verze: CONFIG.appVersion
        });
        document.getElementById('nahlasit-formular').classList.add('hidden');
        document.getElementById('nahlasit-hotovo').classList.remove('hidden');
      } catch (e) {
        console.warn('Nahlášení chyby selhalo:', e.message);
        chybaEl.textContent = /zítra/.test(e.message)
          ? e.message
          : 'Hlášení se nepodařilo odeslat. Zkontroluj připojení a zkus to znovu.';
        chybaEl.classList.remove('hidden');
        btnOdes.disabled = false;
      }
    });

    document.getElementById('btn-nahlasit-zrusit').addEventListener('click', zavri);
    document.getElementById('btn-nahlasit-zavrit').addEventListener('click', zavri);
    modal.addEventListener('click', e => { if (e.target === modal) zavri(); });
  }

  // ─── Ostatní event listenery ──────────────────────────────────
  function initEventy() {
    document.getElementById('btn-odeslat').addEventListener('click', odeslat);
    document.getElementById('btn-napoveda').addEventListener('click', pozadejNapovedu);
    document.getElementById('vstup-pole').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); odeslat(); }
    });

    document.getElementById('btn-dalsi').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;  // zabráň dvojkliku
      const jePosledni = aktualniUlohaIndex >= aktualniTema.ulohy.length - 1;
      if (jePosledni) {
        await dokonceniSady();
      } else {
        nactiUlohu(aktualniUlohaIndex + 1);
      }
      // Re-enable pokud stránka zůstala na screen-uloha (nactiUlohu ji skryje/znovuzobrazí)
      e.currentTarget.disabled = false;
    });

    document.getElementById('btn-zpet-z-ulohy').addEventListener('click', () => {
      ulozKonverzaci();  // rozdělaná sada zůstane v panelu „Rozpracované“

      // Pokud uživatel dokončil všechny úlohy ale kliknul Zpět místo "Ukončit sadu",
      // sada se musí započítat — jinak by denní counter zůstal na 0.
      if (_posledniDokoncena && !_sadaZapoctena) {
        const temaId = aktualniTema?._temaId || aktualniTema?.id;
        const userId = Auth.getSession()?.user?.id;
        if (temaId && userId) {
          SessionProgress.spustiSadu(temaId, userId).then(({ count }) => {
            if (count >= 3) SessionProgress.uzamkniSadu(temaId, userId);
          });
          _sadaZapoctena = true;
        }
      }
      // Hotová sada do rozpracovaných nepatří
      if (_posledniDokoncena) smazRozpracovanou(aktualniTema?.sadaId);

      sessionStorage.removeItem(SESSION_KEY);  // hard refresh z home screenu = zůstat na home
      zobrazDomovskou();
    });
    document.getElementById('btn-zpet-z-vysledku').addEventListener('click', () => {
      zobrazDomovskou();
    });
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

    // Tlačítko "Chyba?" — hlášení se uloží do Supabase i se snímkem úlohy a konverzace
    initNahlaseniChyby();

    // Modal "Skvělá práce na dnes!" — zavřít
    document.getElementById('btn-modal-zpet')?.addEventListener('click', zavriModalDnesHotovo);
    document.getElementById('modal-dnes-hotovo')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) zavriModalDnesHotovo();
    });

    // Modal "Co je nového" — zavřít
    document.getElementById('btn-modal-novinky-ok')?.addEventListener('click', zavriModalNovinky);
    document.getElementById('modal-novinky')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) zavriModalNovinky();
    });

    // Onboarding tutorial
    document.getElementById('btn-ob-dalsi')?.addEventListener('click', _obDalsi);
    document.getElementById('btn-ob-zpet')?.addEventListener('click', _obZpet);

    // Profil — otevřít
    document.getElementById('btn-otevre-profil')?.addEventListener('click', zobrazProfil);

    // Profil — zpět + uložit + GDPR akce
    document.getElementById('btn-zpet-z-profilu')?.addEventListener('click', zobrazDomovskou);
    document.getElementById('btn-profil-ulozit')?.addEventListener('click', ulozProfil);
    document.getElementById('btn-export-dat')?.addEventListener('click', exportDat);
    document.getElementById('btn-smazat-ucet')?.addEventListener('click', smazatUcet);
    document.getElementById('btn-znovu-tutorial')?.addEventListener('click', () => {
      zobrazDomovskou();
      _obKrok = 1;
      _obRenderTridy();
      _obAktualizuj();
      document.getElementById('modal-onboarding').classList.remove('hidden');
    });

    // Statistiky
    document.getElementById('btn-statistiky')?.addEventListener('click', zobrazStatistiky);
    document.getElementById('btn-zpet-ze-statistik')?.addEventListener('click', zobrazDomovskou);
    initStatsTcgKarty();

    // Časy „před 5 min“ v panelu Rozpracované drž aktuální
    setInterval(() => {
      const homeVisible = !document.getElementById('screen-home').classList.contains('hidden');
      if (homeVisible) renderRozpracovane();
    }, 60 * 1000);

    // Rozpracované sady změněné v jiném tabu → aktualizuj panel hned
    window.addEventListener('storage', e => {
      if (e.key !== klicUzivatele(ROZPRACOVANE_KEY)) return;
      const homeVisible = !document.getElementById('screen-home').classList.contains('hidden');
      if (homeVisible) renderRozpracovane();
    });

    // Záchranný save konverzace při opuštění tabu + obnova home screen %
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        ulozKonverzaci();  // tab se skryl — ulož pro případ nehody
        Sync.odesliHned();
      } else if (Auth.jeAuthenticated()) {
        const homeVisible = !document.getElementById('screen-home').classList.contains('hidden');
        if (homeVisible) {
          renderTemata();
          // Žák mohl mezitím pokračovat na jiném zařízení
          Sync.stahniVse().then(zmena => { if (zmena) obnovDomovskouPoSynchronizaci(); });
        }
      }
    });
  }

  // ─── Inicializace ─────────────────────────────────────────────
  async function init() {
    Sync.init({
      klicUzivatele,
      konvKlic:          _konvKlic,
      nactiRozpracovane,
      zapisRozpracovane: _zapisRozpracovane,
      smazSaduZMapy:     _smazSaduZMapy,
      nactiVysledky,
      zapisVysledky:     _zapisVysledky,
      nactiTypy:         _nactiTypy,
      zapisTypy:         _zapisTypy
    });
    initDarkMode();
    initAvatarUpload();
    initCropModalEventy();

    // Zaregistruj callback PŘED Auth.init() (race condition prevence)
    Auth.onSessionChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') zobrazModalNoveHeslo();
      if (event === 'SIGNED_OUT') {
        // Debounce — Supabase může krátce vyvolat SIGNED_OUT při automatické
        // obnově tokenu (např. po alt-tabu). Počkáme 700 ms; pokud mezitím
        // přijde TOKEN_REFRESHED nebo SIGNED_IN se session, timer zrušíme.
        clearTimeout(_signOutTimer);
        _signOutTimer = setTimeout(() => {
          if (!Auth.jeAuthenticated()) {
            profil         = null;
            odemcenaTemata = null;
            SessionProgress.resetCache();
            document.getElementById('user-dropdown-wrap').classList.add('hidden');
            zobrazAuthScreen();
          }
        }, 700);
      } else if (session) {
        // TOKEN_REFRESHED, SIGNED_IN, INITIAL_SESSION — vždy zrušíme timer
        clearTimeout(_signOutTimer);
        if (event === 'SIGNED_IN' && !_pokracujBezi) {
          // Spuštění pokracujPoLoginu jen pokud jsme skutečně na přihlašovací
          // obrazovce — Supabase v2 občas vyvolá SIGNED_IN i při obnově tokenu
          // (alt-tab, TOKEN_REFRESHED), což by jinak přesměrovalo na home screen
          // uprostřed řešené úlohy.
          const naAuthScreenu = !document.getElementById('screen-auth').classList.contains('hidden');
          if (naAuthScreenu) {
            _pokracujBezi = true;
            pokracujPoLoginu(session).finally(() => { _pokracujBezi = false; });
          }
        }
      }
    });

    const odkaz   = prectiOdkazZEmailu();
    const session = await Auth.init();

    initAuthEventy();
    initEventy();

    if (session) {
      await pokracujPoLoginu(session);
      if (odkaz.obnova) zobrazModalNoveHeslo();
    } else {
      zobrazAuthScreen();
      if (odkaz.chyba) {
        const chybaEl = document.getElementById('auth-chyba');
        chybaEl.textContent = 'Odkaz z e-mailu už vypršel nebo byl použitý. Pokud jsi chtěl/a změnit heslo, nech si poslat nový přes „Zapomněl/a jsi heslo?“.';
        chybaEl.classList.remove('hidden');
      }
    }
    if (odkaz.chyba || odkaz.obnova) uklidOdkazZEmailu();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
