// app.js — routing mezi obrazovkami, UI logika

const App = (() => {
  // ─── Stav aplikace ───────────────────────────────────────────
  let aktualniTema = null;
  let aktualniUlohaIndex = 0;
  let skore = { spravne: 0, celkem: 0, temy: {} };
  let dialogLog = [];

  // Progress v localStorage
  function nactiProgress() {
    try {
      return JSON.parse(localStorage.getItem('matika_progress') || '{}');
    } catch { return {}; }
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

  // ─── Obrazovky ───────────────────────────────────────────────
  function zobrazDomovskou() {
    document.getElementById('screen-home').classList.remove('hidden');
    document.getElementById('screen-uloha').classList.add('hidden');
    document.getElementById('screen-vysledky').classList.add('hidden');
    renderTemata();
  }

  function zobrazUlohu() {
    document.getElementById('screen-home').classList.add('hidden');
    document.getElementById('screen-uloha').classList.remove('hidden');
    document.getElementById('screen-vysledky').classList.add('hidden');
  }

  function zobrazVysledky() {
    document.getElementById('screen-home').classList.add('hidden');
    document.getElementById('screen-uloha').classList.add('hidden');
    document.getElementById('screen-vysledky').classList.remove('hidden');
    renderVysledky();
  }

  // ─── Domovská obrazovka ───────────────────────────────────────
  function renderTemata() {
    const grid = document.getElementById('temata-grid');
    grid.innerHTML = '';
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
      karta.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spustTema(tema); } });
      grid.appendChild(karta);
    });
  }

  // ─── Spuštění tématu ──────────────────────────────────────────
  function spustTema(tema) {
    aktualniTema = tema;
    aktualniUlohaIndex = 0;
    skore = { spravne: 0, celkem: tema.ulohy.length, temy: {} };
    dialogLog = [];
    zobrazUlohu();
    renderHlavickaUlohy();
    nactiUlohu(0);
  }

  function renderHlavickaUlohy() {
    document.getElementById('uloha-tema-nazev').textContent = aktualniTema.nazev;
  }

  // ─── Načtení úlohy ────────────────────────────────────────────
  function nactiUlohu(index) {
    if (index >= aktualniTema.ulohy.length) {
      zobrazVysledky();
      return;
    }
    aktualniUlohaIndex = index;
    const uloha = aktualniTema.ulohy[index];
    dialogLog = [];

    // Progress bar nahoře
    const procent = Math.round((index / aktualniTema.ulohy.length) * 100);
    document.getElementById('uloha-progress-fill').style.width = procent + '%';
    document.getElementById('uloha-progress-text').textContent = `Úloha ${index + 1} z ${aktualniTema.ulohy.length}`;

    // Inicializace enginu
    const uvod = Engine.inicializuj(uloha);

    // Vyčisti dialog
    const logEl = document.getElementById('dialog-log');
    logEl.innerHTML = '';

    // Zobraz zadání + první otázku
    pridejZpravu('system', uvod.text);
    pridejZpravu('hint', uvod.otazka);

    // Vstupní pole
    document.getElementById('vstup-pole').value = '';
    document.getElementById('vstup-pole').disabled = false;
    document.getElementById('btn-odeslat').disabled = false;
    document.getElementById('btn-dalsi').classList.add('hidden');
    document.getElementById('vstup-pole').focus();
  }

  // ─── Dialog ──────────────────────────────────────────────────
  function pridejZpravu(typ, text) {
    dialogLog.push({ typ, text });
    const logEl = document.getElementById('dialog-log');
    const msg = document.createElement('div');
    msg.className = `msg msg-${typ}`;

    const ikona = { system: '📋', student: '✏️', hint: '💡', uspech: '✅', reseni: '📖', chyba: '⚠️', info: 'ℹ️' };
    const label = { system: 'Zadání', student: 'Ty', hint: 'Nápověda', uspech: 'Správně', reseni: 'Řešení', chyba: 'Upozornění', info: 'Info' };

    msg.innerHTML = `
      <span class="msg-ikona" aria-hidden="true">${ikona[typ] || '•'}</span>
      <div class="msg-obsah">
        <span class="msg-label">${label[typ] || typ}</span>
        <p class="msg-text">${escapujHtml(text)}</p>
      </div>
    `;
    logEl.appendChild(msg);

    // Animace
    requestAnimationFrame(() => msg.classList.add('msg-visible'));

    // Scroll na konec
    logEl.scrollTop = logEl.scrollHeight;
  }

  function escapujHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // ─── Odeslání odpovědi ────────────────────────────────────────
  function odeslat() {
    const vstupEl = document.getElementById('vstup-pole');
    const vstup = vstupEl.value.trim();
    if (!vstup) {
      vstupEl.classList.add('shake');
      setTimeout(() => vstupEl.classList.remove('shake'), 400);
      return;
    }

    // Zobraz studentovu odpověď
    pridejZpravu('student', vstup);
    vstupEl.value = '';

    // Vyhodnoť
    const vysledek = Engine.vyhodnotVstup(vstup);
    if (!vysledek) return;

    if (vysledek.typ === 'chyba') {
      pridejZpravu('chyba', vysledek.text);
      return;
    }

    if (vysledek.typ === 'napoveda') {
      pridejZpravu('hint', vysledek.napoveda);
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
    }
  }

  function dokoncUlohu() {
    document.getElementById('vstup-pole').disabled = true;
    document.getElementById('btn-odeslat').disabled = true;
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

    // Breakdown
    const breakdown = document.getElementById('vysledky-breakdown');
    breakdown.innerHTML = `<p>Téma: <strong>${aktualniTema.nazev}</strong> — ${skore.spravne}/${skore.celkem} správně</p>`;
  }

  // ─── Dark mode ────────────────────────────────────────────────
  function initDarkMode() {
    const btn = document.getElementById('btn-dark-mode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const ulozene = localStorage.getItem('matika_darkmode');
    const dark = ulozene !== null ? ulozene === '1' : prefersDark;

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

  // ─── Event listenery ──────────────────────────────────────────
  function initEventy() {
    document.getElementById('btn-odeslat').addEventListener('click', odeslat);

    document.getElementById('vstup-pole').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        odeslat();
      }
    });

    document.getElementById('btn-dalsi').addEventListener('click', () => {
      nactiUlohu(aktualniUlohaIndex + 1);
    });

    document.getElementById('btn-zpet-z-ulohy').addEventListener('click', () => {
      zobrazDomovskou();
    });

    document.getElementById('btn-zpet-z-vysledku').addEventListener('click', () => {
      zobrazDomovskou();
    });

    document.getElementById('btn-znovu').addEventListener('click', () => {
      if (aktualniTema) spustTema(aktualniTema);
    });
  }

  // ─── Inicializace ─────────────────────────────────────────────
  function init() {
    initDarkMode();
    initEventy();
    zobrazDomovskou();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
