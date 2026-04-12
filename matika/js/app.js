// app.js — routing mezi obrazovkami, UI logika

const App = (() => {
  // ─── Stav aplikace ───────────────────────────────────────────
  let aktualniTema = null;
  let aktualniUlohaIndex = 0;
  let skore = { spravne: 0, celkem: 0 };
  let dialogLog = [];
  let cekaNaApi = false;

  // ─── localStorage helpers ────────────────────────────────────
  function nactiProgress() {
    try { return JSON.parse(localStorage.getItem('matika_progress') || '{}'); }
    catch { return {}; }
  }

  function ulozProgress(temaId, ulohaId, uspech) {
    const p = nactiProgress();
    if (!p[temaId]) p[temaId] = {};
    p[temaId][ulohaId] = uspech ? 'spravne' : (p[temaId][ulohaId] || 'pokus');
    localStorage.setItem('matika_progress', JSON.stringify(p));
  }

  function pocetDokoncenychUloh(temaId) {
    const p = nactiProgress();
    if (!p[temaId]) return 0;
    return Object.values(p[temaId]).filter(v => v === 'spravne').length;
  }

  function maApiKlic() {
    return !!localStorage.getItem(CONFIG.apiKeyStorageKey);
  }

  // ─── Správa obrazovek ─────────────────────────────────────────
  const SCREENS = ['screen-home', 'screen-apikey', 'screen-uloha', 'screen-vysledky'];

  function zobrazScreen(id) {
    SCREENS.forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  }

  function zobrazDomovskou() {
    zobrazScreen('screen-home');
    renderTemata();
  }

  function zobrazApiKlic(callbackPoCancelaci) {
    zobrazScreen('screen-apikey');
    document.getElementById('apikey-input').value =
      localStorage.getItem(CONFIG.apiKeyStorageKey) || '';
    document.getElementById('apikey-input').focus();

    // Tlačítko Zpět/Přeskočit — skryj pokud je to první spuštění (žádný klíč)
    const btnZpet = document.getElementById('btn-apikey-zpet');
    if (callbackPoCancelaci) {
      btnZpet.classList.remove('hidden');
      btnZpet.onclick = callbackPoCancelaci;
    } else {
      btnZpet.classList.add('hidden');
    }
  }

  function zobrazUlohu() { zobrazScreen('screen-uloha'); }

  function zobrazVysledky() {
    zobrazScreen('screen-vysledky');
    renderVysledky();
  }

  // ─── Domovská obrazovka ───────────────────────────────────────
  function renderTemata() {
    const grid = document.getElementById('temata-grid');
    grid.innerHTML = '';

    // Indikátor AI módu
    const aiStav = document.getElementById('ai-stav');
    if (aiStav) {
      aiStav.textContent = maApiKlic() ? '🤖 AI mód aktivní' : '📖 Statický mód';
      aiStav.className = maApiKlic() ? 'ai-stav ai-on' : 'ai-stav ai-off';
    }

    TEMATA.forEach(tema => {
      const celkem = tema.ulohy.length;
      const hotovo = pocetDokoncenychUloh(tema.id);
      const procent = celkem > 0 ? Math.round((hotovo / celkem) * 100) : 0;

      const karta = document.createElement('div');
      karta.className = 'tema-karta';
      karta.setAttribute('role', 'button');
      karta.setAttribute('tabindex', '0');
      karta.setAttribute('aria-label', `Téma: ${tema.nazev}`);
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
      `;
      karta.addEventListener('click', () => spustTema(tema));
      karta.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spustTema(tema); }
      });
      grid.appendChild(karta);
    });
  }

  // ─── Spuštění tématu ──────────────────────────────────────────
  function spustTema(tema) {
    aktualniTema = tema;
    aktualniUlohaIndex = 0;
    skore = { spravne: 0, celkem: tema.ulohy.length };
    dialogLog = [];
    zobrazUlohu();
    document.getElementById('uloha-tema-nazev').textContent = tema.nazev;
    nactiUlohu(0);
  }

  // ─── Načtení úlohy (async — čeká na úvodní otázku z API) ─────
  async function nactiUlohu(index) {
    if (index >= aktualniTema.ulohy.length) {
      zobrazVysledky();
      return;
    }
    aktualniUlohaIndex = index;
    const uloha = aktualniTema.ulohy[index];
    dialogLog = [];

    // Progress bar
    const procent = Math.round((index / aktualniTema.ulohy.length) * 100);
    document.getElementById('uloha-progress-fill').style.width = procent + '%';
    document.getElementById('uloha-progress-text').textContent =
      `Úloha ${index + 1} z ${aktualniTema.ulohy.length}`;

    // Inicializace enginu
    const uvod = Engine.inicializuj(uloha);

    // Vyčisti dialog
    document.getElementById('dialog-log').innerHTML = '';

    // Zobraz zadání
    pridejZpravu('system', uvod.text);

    // Vstupní pole — zamknout dokud nedostaneme první otázku
    setVstupDisabled(true);
    document.getElementById('btn-dalsi').classList.add('hidden');

    // Zobraz loading a získej úvodní otázku (AI nebo statická)
    pokazLoadingIndikator();
    const uvodniOtazka = await Engine.getUvodniOtazka();
    skrejLoadingIndikator();

    if (uvodniOtazka.error && !uvodniOtazka.fallback) {
      zobrazApiChybu(uvodniOtazka.error);
    }
    pridejZpravu('hint', uvodniOtazka.text);

    // Odemknout vstup
    setVstupDisabled(false);
    document.getElementById('vstup-pole').value = '';
    document.getElementById('vstup-pole').focus();
  }

  // ─── Loading indikátor ────────────────────────────────────────
  function pokazLoadingIndikator() {
    cekaNaApi = true;
    setVstupDisabled(true);
    const logEl = document.getElementById('dialog-log');
    const el = document.createElement('div');
    el.id = 'loading-msg';
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
    document.getElementById('vstup-pole').disabled = disabled;
    document.getElementById('btn-odeslat').disabled = disabled;
  }

  // ─── Dialog ──────────────────────────────────────────────────
  function pridejZpravu(typ, text) {
    dialogLog.push({ typ, text });
    const logEl = document.getElementById('dialog-log');
    const msg = document.createElement('div');
    msg.className = `msg msg-${typ}`;

    const ikona  = { system: '📋', student: '✏️', hint: '💡', uspech: '✅', reseni: '📖', chyba: '⚠️', info: 'ℹ️', apierror: '🔌' };
    const label  = { system: 'Zadání', student: 'Ty', hint: 'Nápověda', uspech: 'Správně', reseni: 'Řešení', chyba: 'Upozornění', info: 'Info', apierror: 'Chyba API' };

    msg.innerHTML = `
      <span class="msg-ikona" aria-hidden="true">${ikona[typ] || '•'}</span>
      <div class="msg-obsah">
        <span class="msg-label">${label[typ] || typ}</span>
        <p class="msg-text">${escapujHtml(text)}</p>
      </div>
    `;
    logEl.appendChild(msg);
    requestAnimationFrame(() => msg.classList.add('msg-visible'));
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

  // ─── Odeslání odpovědi (async) ────────────────────────────────
  async function odeslat() {
    if (cekaNaApi) return;

    const vstupEl = document.getElementById('vstup-pole');
    const vstup = vstupEl.value.trim();
    if (!vstup) {
      vstupEl.classList.add('shake');
      setTimeout(() => vstupEl.classList.remove('shake'), 400);
      return;
    }

    pridejZpravu('student', vstup);
    vstupEl.value = '';

    // Spusť loading
    pokazLoadingIndikator();

    const vysledek = await Engine.vyhodnotVstup(vstup);

    skrejLoadingIndikator();

    if (!vysledek) return;

    if (vysledek.typ === 'chyba') {
      pridejZpravu('chyba', vysledek.text);
      setVstupDisabled(false);
      return;
    }

    // Upozornění na fallback (API chyba)
    if (vysledek.fallback && vysledek.error) {
      zobrazApiChybu(vysledek.error);
    }

    if (vysledek.typ === 'napoveda') {
      pridejZpravu('hint', vysledek.text);
      setVstupDisabled(false);
      vstupEl.focus();
    } else if (vysledek.typ === 'uspech') {
      pridejZpravu('uspech', vysledek.text);
      ulozProgress(aktualniTema.id, aktualniTema.ulohy[aktualniUlohaIndex].id, true);
      skore.spravne++;
      dokoncUlohu();
    } else if (vysledek.typ === 'reseni') {
      pridejZpravu('reseni', vysledek.text);
      ulozProgress(aktualniTema.id, aktualniTema.ulohy[aktualniUlohaIndex].id, false);
      dokoncUlohu();
    } else if (vysledek.typ === 'info') {
      pridejZpravu('info', vysledek.text);
      setVstupDisabled(false);
    }
  }

  function dokoncUlohu() {
    setVstupDisabled(true);
    const btnDalsi = document.getElementById('btn-dalsi');
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

  // ─── API klíč ─────────────────────────────────────────────────
  function ulozApiKlic() {
    const vstup = document.getElementById('apikey-input').value.trim();
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
    const btn = document.getElementById('btn-dark-mode');
    const ulozene = localStorage.getItem('matika_darkmode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = ulozene !== null ? ulozene === '1' : prefersDark;
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');

    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.toggleAttribute('data-theme');
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('matika_darkmode', '0');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('matika_darkmode', '1');
      }
    });
  }

  // ─── Event listenery ──────────────────────────────────────────
  function initEventy() {
    // Zadání odpovědi
    document.getElementById('btn-odeslat').addEventListener('click', odeslat);
    document.getElementById('vstup-pole').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); odeslat(); }
    });

    // Navigace úlohami
    document.getElementById('btn-dalsi').addEventListener('click', () => {
      nactiUlohu(aktualniUlohaIndex + 1);
    });
    document.getElementById('btn-zpet-z-ulohy').addEventListener('click', zobrazDomovskou);
    document.getElementById('btn-zpet-z-vysledku').addEventListener('click', zobrazDomovskou);
    document.getElementById('btn-znovu').addEventListener('click', () => {
      if (aktualniTema) spustTema(aktualniTema);
    });

    // API klíč — uložení
    document.getElementById('btn-apikey-uloz').addEventListener('click', ulozApiKlic);
    document.getElementById('apikey-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') ulozApiKlic();
    });

    // API klíč — změna z hlavičky
    document.getElementById('btn-zmenit-klic').addEventListener('click', () => {
      zobrazApiKlic(() => zobrazDomovskou());
    });

    // API klíč — smazání
    document.getElementById('btn-apikey-smazat').addEventListener('click', smazApiKlic);

    // Přeskočit bez AI
    document.getElementById('btn-apikey-preskocit').addEventListener('click', () => {
      localStorage.removeItem(CONFIG.apiKeyStorageKey);
      zobrazDomovskou();
    });
  }

  // ─── Inicializace ─────────────────────────────────────────────
  function init() {
    initDarkMode();
    initEventy();

    // Při prvním spuštění bez klíče → zobraz obrazovku pro zadání klíče
    if (!maApiKlic()) {
      zobrazApiKlic(null); // null = bez tlačítka Zpět
    } else {
      zobrazDomovskou();
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
