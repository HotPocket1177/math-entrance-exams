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

  // ─── Per-cyklus výběr úloh ───────────────────────────────────
  const TASKS_PER_CYCLE    = 5;
  const HISTORY_KEY        = 'matika_history';           // { temaId: { taskId: timestampMs } }
  const SESSION_KEY        = 'matika_session_stav';      // sessionStorage: obnova po hard refresh
  const COOLDOWN_PRIMARY   = 30 * 24 * 60 * 60 * 1000;  // 30 dní (ideál)
  const COOLDOWN_SECONDARY =  7 * 24 * 60 * 60 * 1000;  // 7 dní (fallback)

  // ─── Resume stav ─────────────────────────────────────────────
  // Uloží se při kliknutí "Zpět" uprostřed sady; obnoví se při opětovném
  // otevření stejného tématu, aby uživatel pokračoval tam, kde skončil.
  let _resumeState = null;  // { temaId, tema, index, skore } | null

  // ─── Persistence konverzace (localStorage) ───────────────────
  // Klíč: matika_konv__{temaId}__{ulohaId}
  // Ukládá: dialogLog + engine stav + postup panel — vše potřebné pro obnovu.
  function _konvKlic(temaId, ulohaId) {
    return `matika_konv__${temaId}__${ulohaId}`;
  }

  function ulozKonverzaci() {
    if (!aktualniTema || aktualniUlohaIndex == null) return;
    const uloha  = aktualniTema.ulohy[aktualniUlohaIndex];
    if (!uloha) return;
    const temaId = aktualniTema._temaId || aktualniTema.id;
    try {
      const data = {
        dialogLog:  dialogLog.slice(),
        engineStav: Engine.ulozStav(),
      };
      localStorage.setItem(_konvKlic(temaId, uloha.id), JSON.stringify(data));
    } catch { /* localStorage plný — tiše ignoruj */ }
  }

  function obnovKonverzaci(temaId, ulohaId) {
    try {
      const raw = localStorage.getItem(_konvKlic(temaId, ulohaId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function smazKonverzaci(temaId, ulohaId) {
    localStorage.removeItem(_konvKlic(temaId, ulohaId));
  }

  // ─── Session stav (obnova po hard refresh) ────────────────────
  // Ukládá se do sessionStorage (přežije Ctrl+Shift+R ve stejném tabu,
  // ale ne zavření tabu). Maže se při Zpět na home nebo dokončení cyklu.

  function ulozSessionStav() {
    if (!aktualniTema?.ulohy?.length) return;
    const temaId = aktualniTema._temaId || aktualniTema.id;
    try {
      // kontrola je funkce — nelze serializovat; obnoví se přes _rekonstruujKontrola
      const ulohySerial = aktualniTema.ulohy.map(({ kontrola, ...rest }) => rest);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        temaId,
        tema:  { ...aktualniTema, ulohy: ulohySerial },
        index: aktualniUlohaIndex,
        skore: { ...skore }
      }));
    } catch {}
  }

  function smazSessionStav() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function vycistiLocalStorage({ smazatAvatar = false } = {}) {
    const aktualniAvatarKlic = _avatarKlic();
    const zachovat = new Set(['matika_darkmode', 'matika_openai_key']);
    // Při normálním odhlášení avatar zachováme — uživatel ho uvidí po přihlášení
    if (!smazatAvatar && aktualniAvatarKlic) zachovat.add(aktualniAvatarKlic);
    const smazat = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('matika_avatar_') && !smazatAvatar) continue; // cizí avatary vždy nechej
      if (key.startsWith('matika_') && !zachovat.has(key)) smazat.push(key);
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
    // Poslední záchrana — volná shoda s odpovědí
    return (vstup) => {
      const n = vstup.trim().toLowerCase();
      const a = (u.odpoved || '').toLowerCase();
      return n.length > 0 && (n.includes(a.substring(0, 6)) || a.includes(n.substring(0, 6)));
    };
  }

  function obnovSessionStav() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data?.temaId || !data?.tema?.ulohy?.length) return null;
      const ulohy = data.tema.ulohy.map(u => ({ ...u, kontrola: _rekonstruujKontrola(u) }));
      return {
        temaId: data.temaId,
        tema:   { ...data.tema, ulohy },
        index:  data.index ?? 0,
        skore:  data.skore ?? { spravne: 0, celkem: ulohy.length }
      };
    } catch { return null; }
  }

  // ─── Správa obrazovek ─────────────────────────────────────────
  const SCREENS = ['screen-auth', 'screen-home', 'screen-apikey', 'screen-uloha', 'screen-vysledky', 'screen-profil', 'screen-statistiky'];

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

    const [profilRes, progressRes, sessionRes] = await Promise.all([
      sb.from('profiles').select('*').eq('id', userId).single(),
      sb.from('progress').select('*').eq('user_id', userId),
      sb.from('session_progress').select('*').eq('user_id', userId),
    ]);

    const exportData = {
      exportDatum: new Date().toISOString(),
      uzivatel:    { id: userId, email },
      profil:      profilRes.data,
      progress:    progressRes.data,
      sessionProgress: sessionRes.data,
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
      vycistiLocalStorage({ smazatAvatar: true });
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
    const trida = profil?.trida || 8;
    const p     = nactiProgress();
    let celkemSpravne = 0, celkemPokus = 0, celkemUloh = 0;
    const temaData = [];

    TEMATA.forEach(tema => {
      const ulohy = Syllabus.getUlohyProTridu(tema.id, trida);
      if (!ulohy.length) return;
      const temaProgress = p[tema.id] || {};
      let spravne = 0, pokus = 0;
      Object.entries(temaProgress).forEach(([id, v]) => {
        if (id.startsWith('gen_')) return;
        if (v === 'spravne') spravne++;
        else pokus++;
      });
      const celkem = ulohy.filter(u => !u.id.startsWith('gen_')).length;
      const procent = celkem > 0 ? Math.round((spravne / celkem) * 100) : 0;
      celkemSpravne += spravne;
      celkemPokus   += pokus;
      celkemUloh    += celkem;
      temaData.push({ tema, spravne, pokus, celkem, procent });
    });

    // Summary karty
    const uspesnost = (celkemSpravne + celkemPokus) > 0
      ? Math.round((celkemSpravne / (celkemSpravne + celkemPokus)) * 100) : 0;
    const sadyDnes = TEMATA.reduce((s, t) => s + SessionProgress.getDokonceniCount(t.id), 0);
    document.getElementById('stats-splneno').textContent  = `${celkemSpravne}/${celkemUloh}`;
    document.getElementById('stats-uspesnost').textContent = `${uspesnost} %`;
    document.getElementById('stats-dnes').textContent      = `${sadyDnes}`;

    // Seznam témat — seřadit od nejhoršího %
    temaData.sort((a, b) => a.procent - b.procent);
    const listEl = document.getElementById('stats-temata-list');
    listEl.innerHTML = temaData.map(({ tema, spravne, pokus, celkem, procent }) => `
      <div class="stats-tema-radek">
        <span class="stats-tema-ikona">${tema.ikona}</span>
        <div class="stats-tema-info">
          <div class="stats-tema-hlavicka">
            <span class="stats-tema-nazev">${tema.nazev}</span>
            <span class="stats-tema-procent">${procent} %</span>
          </div>
          <div class="stats-bar-wrap">
            <div class="stats-bar-fill" style="width:${procent}%"></div>
          </div>
          <div class="stats-tema-detail">${spravne} správně · ${pokus} rozděláno · ${celkem - spravne - pokus} zbývá</div>
        </div>
      </div>
    `).join('');

    // Highlights
    const sPokusem = temaData.filter(d => d.spravne + d.pokus > 0);
    const nejlepsi = [...temaData].sort((a, b) => b.procent - a.procent)[0];
    const nejhorsi = sPokusem.sort((a, b) => a.procent - b.procent)[0];
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

    // Hlavička — zobraz avatar dropdown
    const email = session?.user?.email || Auth.getSession()?.user?.email || '';
    document.getElementById('dropdown-email').textContent  = email;
    document.getElementById('user-dropdown-wrap').classList.remove('hidden');
    renderProfilAvatar(email);
    renderDropdownTridy();

    // Obnova po hard refresh — pokud byl uživatel uprostřed sady, vrátíme ho tam
    const savedStav = obnovSessionStav();
    if (savedStav && !SessionProgress.jeZamceno(savedStav.temaId)) {
      const temaObj = TEMATA.find(t => t.id === savedStav.temaId);
      if (temaObj) {
        _resumeState = savedStav;
        await spustTema(temaObj);
        return;
      }
    }

    zobrazDomovskou();
    zkontrolujOnboarding();
    zkontrolujNovinky();
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

  function zkontrolujOnboarding() {
    if (profil?.onboarding_done === true) return;
    _obKrok  = 1;
    _obTrida = profil?.trida || 8;
    _obRenderTridy();
    _obAktualizuj();
    document.getElementById('modal-onboarding').classList.remove('hidden');
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
    profil = { ...profil, onboarding_done: true };
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

  function ulozProgress(temaId, ulohaId, uspech) {
    // AI-generované příklady mají unikátní ID při každém generování —
    // nemá smysl je sledovat (zkreslují % dokončení statického poolu).
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
        })
        .then(({ error }) => {
          if (error) console.warn('Progress sync selhal:', error.message);
        });
    }
  }

  function pocetDokoncenychUloh(temaId) {
    const p = nactiProgress();
    if (!p[temaId]) return 0;
    // Filtruj AI-generované záznamy (ID začínají "gen_") — mohly se nakupit
    // z dřívějška před zavedením tohoto filtru.
    return Object.entries(p[temaId])
      .filter(([id, v]) => !id.startsWith('gen_') && v === 'spravne')
      .length;
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
      const jeDnesHotovo  = jeOdemceno && SessionProgress.jeZamceno(tema.id);
      const klikatelna    = jeOdemceno && !jeDnesHotovo;
      const celkem        = ulohyProTridu.length;
      const hotovo        = pocetDokoncenychUloh(tema.id);
      const procent       = celkem > 0 ? Math.round((hotovo / celkem) * 100) : 0;
      const minTrida      = !jeOdemceno ? Syllabus.getMinTrida(tema.id) : null;
      const dokonceniCount = jeOdemceno ? SessionProgress.getDokonceniCount(tema.id) : 0;

      const karta = document.createElement('div');
      if (!jeOdemceno)       karta.className = 'tema-karta tema-karta--zamcena';
      else if (jeDnesHotovo) karta.className = 'tema-karta tema-karta--dnes-hotovo';
      else                   karta.className = 'tema-karta';

      karta.setAttribute('role', klikatelna ? 'button' : 'article');
      if (klikatelna) karta.setAttribute('tabindex', '0');
      karta.setAttribute('aria-label',
        `Téma: ${tema.nazev}${!jeOdemceno ? ' (zamčeno)' : jeDnesHotovo ? ' (hotovo na dnes)' : ''}`);

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
        ${!jeOdemceno   ? `<span class="tema-zamek" aria-hidden="true">🔒</span>` : ''}
        ${!jeOdemceno   ? `<p class="tema-zamceno-text">Dostupné od ${minTrida}. třídy</p>` : ''}
        ${jeDnesHotovo  ? `<span class="tema-zamek tema-zamek--hotovo" aria-hidden="true">✓</span>` : ''}
        ${jeDnesHotovo  ? `<p class="tema-zamceno-text">Hotovo na dnes · Odemkne se zítra</p>` : ''}
        ${jeOdemceno    ? `
        <div class="tema-cykly" aria-label="Dnes ${dokonceniCount} ze 3 cyklů">
          <span class="cyklus-puntik${dokonceniCount >= 1 ? ' hotovy' : ''}"></span>
          <span class="cyklus-puntik${dokonceniCount >= 2 ? ' hotovy' : ''}"></span>
          <span class="cyklus-puntik${dokonceniCount >= 3 ? ' hotovy' : ''}"></span>
          <span class="cykly-text">Dnes: ${dokonceniCount}/3</span>
        </div>` : ''}
      `;

      if (klikatelna) {
        karta.addEventListener('click', () => spustTema(tema));
        karta.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spustTema(tema); }
        });
      }

      grid.appendChild(karta);
    });
  }

  // ─── Výběr úloh pro cyklus (bez opakování po dobu 30 dní) ───
  // Historie se ukládá do localStorage s timestampem; úloha se
  // nezobrazí dokud neuplyne COOLDOWN_MS od posledního zobrazení.
  function _nactiHistorii() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
    catch { return {}; }
  }

  function selectUlohyProCyklus(temaId, pool) {
    const now      = Date.now();
    const historie = _nactiHistorii();
    const tema     = historie[temaId] || {};

    // Stupeň 1: příklady nezobrazené v posledních 30 dnech
    let dostupne = pool.filter(u => {
      const t = tema[u.id];
      return !t || (now - t) > COOLDOWN_PRIMARY;
    });

    // Stupeň 2: příklady nezobrazené v posledních 7 dnech
    if (dostupne.length < TASKS_PER_CYCLE) {
      dostupne = pool.filter(u => {
        const t = tema[u.id];
        return !t || (now - t) > COOLDOWN_SECONDARY;
      });
    }

    // Stupeň 3: vezmi nejdéle nepoužívané (LRU) — jen krajní případ malého poolu
    if (dostupne.length < TASKS_PER_CYCLE) {
      dostupne = [...pool].sort((a, b) => (tema[a.id] || 0) - (tema[b.id] || 0));
    }

    // Fisher-Yates shuffle
    for (let i = dostupne.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dostupne[i], dostupne[j]] = [dostupne[j], dostupne[i]];
    }

    const vybrane = dostupne.slice(0, TASKS_PER_CYCLE);

    // Ulož timestamp zobrazení
    vybrane.forEach(u => { tema[u.id] = now; });
    historie[temaId] = tema;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historie));

    return vybrane;
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
    const temaId = tema._temaId || tema.id;

    // Pokud máme uložený stav pro toto téma (uživatel kliknul Zpět uprostřed sady),
    // pokračuj tam, kde přestal — nevolej selectUlohyProCyklus (nezabere nové úlohy).
    // Pokud se uživatel vrátil ke stejnému tématu (Zpět uprostřed sady nebo na 1. úloze),
    // obnov přesně stejnou sadu úloh — jinak by se vybraly jiné úlohy a uložená konverzace
    // by nebyla nalezena pod jiným uloha.id.
    if (_resumeState && _resumeState.temaId === temaId) {
      if (SessionProgress.jeZamceno(temaId)) {
        _resumeState = null;
        zobrazDomovskou();
        zobrazModalDnesHotovo();
        return;
      }
      aktualniTema       = _resumeState.tema;
      aktualniUlohaIndex = _resumeState.index;
      skore              = { ..._resumeState.skore };
      dialogLog          = [];
      _resumeState       = null;
      zobrazUlohu();
      document.getElementById('uloha-tema-nazev').textContent = aktualniTema.nazev;
      nactiUlohu(aktualniUlohaIndex);
      return;
    }

    const trida  = profil?.trida || 8;
    const userId = Auth.getSession()?.user?.id;

    _resumeState = null;

    // Cycle se počítá při DOKONČENÍ sady (ne při spuštění) — jen zkontroluj zámek
    if (SessionProgress.jeZamceno(temaId)) {
      zobrazDomovskou();
      zobrazModalDnesHotovo();
      return;
    }

    // ── Pokus o AI generování ─────────────────────────────────
    let vybrane = null;

    if (Api.jeAiDostupne()) {
      // Nastav aktualniTema ihned s prázdnými úlohami — Zpět tak zachytí správné temaId
      // i když generování ještě neskončilo.
      aktualniTema       = { ...tema, ulohy: [] };
      aktualniUlohaIndex = 0;
      skore              = { spravne: 0, celkem: 0 };

      zobrazUlohu();
      document.getElementById('uloha-tema-nazev').textContent = tema.nazev;
      zobrazNacitani('Generuji nové příklady… ⏳');

      try {
        let hotovo = 0;
        vybrane = await Generator.generujSadu(temaId, trida, TASKS_PER_CYCLE, (n, z) => {
          hotovo = n;
          zobrazNacitani(`Generuji příklady… ${hotovo}/${z}`);
        });
      } catch (err) {
        console.warn('Generator selhal, používám statický pool:', err.message);
        vybrane = null;
      }

      zobrazNacitani(null);

      // Uživatel přešel jinam během generování → tiše storno, žádný cyklus se nezapočítá
      if (document.getElementById('screen-uloha').classList.contains('hidden')) return;
    }

    // ── Fallback: statický pool ───────────────────────────────
    if (!vybrane) {
      const pool  = Syllabus.getUlohyProTridu(temaId, trida);
      const zdroj = pool.length > 0 ? pool : (tema.ulohy || []);
      vybrane = selectUlohyProCyklus(temaId, zdroj);
    }

    aktualniTema       = { ...tema, ulohy: vybrane };
    aktualniUlohaIndex = 0;
    skore              = { spravne: 0, celkem: vybrane.length };
    dialogLog          = [];
    zobrazUlohu();
    document.getElementById('uloha-tema-nazev').textContent = tema.nazev;
    nactiUlohu(0);
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
    _resumeState = null;
    smazSessionStav();  // cyklus dokončen — obnova po refreshi by nezměnila stav
    const temaId = aktualniTema._temaId || aktualniTema.id;
    const userId = Auth.getSession()?.user?.id;

    // Zaregistruj dokončení tohoto cyklu — count++ se děje TEĎ (ne při startu)
    const { count, zamceno } = await SessionProgress.spustiSadu(temaId, userId);

    if (zamceno || count >= 3) {
      // Třetí cyklus dokončen → uzamkni do půlnoci
      await SessionProgress.uzamkniSadu(temaId, userId);
      zobrazDomovskou();
      zobrazModalDnesHotovo();
      return;
    }

    const zbyvaPocet = 3 - count;
    const trida      = profil?.trida || 8;

    let vybrane = null;

    if (Api.jeAiDostupne()) {
      zobrazNacitani('Připravuji další příklady…');
      try {
        vybrane = await Generator.generujSadu(temaId, trida, TASKS_PER_CYCLE);
      } catch {
        vybrane = null;
      }
      zobrazNacitani(null);
    }

    if (!vybrane) {
      const pool  = Syllabus.getUlohyProTridu(temaId, trida);
      const zdroj = pool.length > 0 ? pool : (TEMATA.find(t => t.id === temaId)?.ulohy || []);
      vybrane = selectUlohyProCyklus(temaId, zdroj);
    }

    aktualniTema = { ...aktualniTema, ulohy: vybrane };
    skore        = { spravne: 0, celkem: vybrane.length };
    dialogLog    = [];

    zobrazUlohu();
    document.getElementById('uloha-tema-nazev').textContent = aktualniTema.nazev;
    const introText = zbyvaPocet === 0
      ? 'Sada dokončena! Tohle je tvůj poslední cyklus na dnes.'
      : `Sada dokončena! Ještě ${zbyvaPocet}× a máš dnešní limit.`;
    nactiUlohu(0, introText);
  }

  // ─── Modal "Skvělá práce na dnes!" ────────────────────────────
  function zobrazModalDnesHotovo() {
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
    ulozSessionStav();  // přežije hard refresh (Ctrl+Shift+R) ve stejném tabu
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

    // Vyčisti dialog; výpočetní panel dostane placeholder (zobrazí se po dokončení)
    document.getElementById('dialog-log').innerHTML = '';
    document.getElementById('btn-dalsi').classList.add('hidden');
    zobrazPlaceholderPostupu();

    // Zkus obnovit uloženou konverzaci pro tuto úlohu
    const temaId  = aktualniTema._temaId || aktualniTema.id;
    const ulozena = obnovKonverzaci(temaId, uloha.id);

    if (ulozena && ulozena.dialogLog?.length > 1) {
      // ── Obnova uložené konverzace ─────────────────────────────
      Engine.obnovStav(ulozena.engineStav, uloha);

      ulozena.dialogLog.forEach(m => {
        dialogLog.push(m);
        _renderZprava(m.typ, m.text);
      });

      pridejZpravu('info', '↩ Pokračuješ v rozpracované úloze.');

      if (Engine.jeDokonceno()) {
        dokoncUlohu();
      } else {
        setVstupDisabled(false);
        document.getElementById('vstup-pole').value = '';
        document.getElementById('vstup-pole').focus();
      }
      return;
    }

    // ── Normální inicializace ─────────────────────────────────────
    const uvod = Engine.inicializuj(uloha, kontextZaka);
    pridejZpravu('system', uvod.text);

    setVstupDisabled(true);

    pokazLoadingIndikator();
    const uvodniOtazka = await Engine.getUvodniOtazka();
    skrejLoadingIndikator();

    if (uvodniOtazka.error) zobrazApiChybu(uvodniOtazka.error);
    if (introZprava) pridejZpravu('info', introZprava);
    pridejZpravu('hint', uvodniOtazka.text);

    setVstupDisabled(false);
    document.getElementById('vstup-pole').value = '';
    document.getElementById('vstup-pole').focus();
  }

  // Renderuje zprávu do DOM bez přidání do dialogLog (pro obnovu uložené konverzace)
  function _renderZprava(typ, text) {
    const logEl = document.getElementById('dialog-log');
    const msg   = document.createElement('div');
    msg.className = `msg msg-${typ} msg-visible`;

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

  // Placeholder v pravém panelu během řešení (postup se zobrazí po dokončení)
  function zobrazPlaceholderPostupu() {
    const log = document.getElementById('vypocet-log');
    if (!log) return;
    log.innerHTML = '<div class="vypocet-placeholder">Podrobné řešení se zobrazí po dokončení příkladu.</div>';
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
      popisEl.textContent = krok.popis;  // textContent → $ v textu zpracuje renderMath níže
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

    if (vysledek.typ === 'napoveda') {
      pridejZpravu('hint', vysledek.text);
      ulozKonverzaci();
      setVstupDisabled(false);
      document.getElementById('vstup-pole').focus();
    } else if (vysledek.typ === 'uspech') {
      pridejZpravu('uspech', vysledek.text);
      ulozProgress(
        aktualniTema._temaId || aktualniTema.id,
        aktualniTema.ulohy[aktualniUlohaIndex].id,
        true
      );
      skore.spravne++;
      dokoncUlohu();
    } else if (vysledek.typ === 'reseni') {
      pridejZpravu('reseni', vysledek.text);
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

    const temaId = aktualniTema._temaId || aktualniTema.id;
    const uloha  = aktualniTema.ulohy[aktualniUlohaIndex];
    if (uloha) smazKonverzaci(temaId, uloha.id);

    // Zobraz celý postup řešení v pravém panelu
    zobrazPostupPoDokonceni();

    const btnDalsi   = document.getElementById('btn-dalsi');
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
    const ulozene   = localStorage.getItem('matika_darkmode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark      = ulozene !== null ? ulozene === '1' : prefersDark;
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
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
        await Auth.prihlasuj(email, password);
        // Pro "nezůstat přihlášen": smažeme token při zavření tabu
        if (!zapamatovat) {
          window.addEventListener('beforeunload', () => {
            Object.keys(localStorage)
              .filter(k => k.endsWith('-auth-token'))
              .forEach(k => localStorage.removeItem(k));
          }, { once: true });
        }
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
        chybaEl.textContent = e.message;
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

  // ─── Ostatní event listenery ──────────────────────────────────
  function initEventy() {
    document.getElementById('btn-odeslat').addEventListener('click', odeslat);
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
      ulozKonverzaci();
      smazSessionStav();  // hard refresh z home screenu = bez obnovy rozpracované sady
      // Ulož stav jen pokud jsou úlohy skutečně načteny (ne uprostřed generování).
      // Bez tohoto guardu by Zpět během generování zachytil prázdné aktualniTema.ulohy
      // a při návratu by nactiUlohu(0) skočilo rovnou na dokonceniSady.
      _resumeState = (aktualniTema?.ulohy?.length > 0) ? {
        temaId: aktualniTema._temaId || aktualniTema.id,
        tema:   aktualniTema,
        index:  aktualniUlohaIndex,
        skore:  { ...skore }
      } : null;
      zobrazDomovskou();
    });
    document.getElementById('btn-zpet-z-vysledku').addEventListener('click', () => {
      _resumeState = null;
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

    // Výpočetní panel — smazat
    document.getElementById('btn-vypocet-smazat').addEventListener('click', () => {
      document.getElementById('vypocet-log').innerHTML = '';
    });

    // Tlačítko "Nahlásit chybu" — zobrazí ID úlohy pro report
    document.getElementById('btn-nahlasit-chybu')?.addEventListener('click', () => {
      if (!aktualniTema) return;
      const uloha  = aktualniTema.ulohy[aktualniUlohaIndex];
      const temaId = aktualniTema._temaId || aktualniTema.id;
      const info   = `Téma: ${temaId} | Úloha ID: ${uloha?.id || '?'}\nZadání: ${uloha?.zadani || '?'}`;
      alert(`Díky za zpětnou vazbu! Pošli tuto informaci autorovi:\n\n${info}`);
    });

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

    // Záchranný save konverzace při opuštění tabu + obnova home screen %
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        ulozKonverzaci();  // tab se skryl — ulož pro případ nehody
      } else if (Auth.jeAuthenticated()) {
        const homeVisible = !document.getElementById('screen-home').classList.contains('hidden');
        if (homeVisible) renderTemata();
      }
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
    initAvatarUpload();
    initCropModalEventy();

    // Zaregistruj callback PŘED Auth.init() (race condition prevence)
    Auth.onSessionChange((event, session) => {
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
