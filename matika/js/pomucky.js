// pomucky.js — pomůcky při řešení: poznámkový blok u úlohy a tahák k tématu
//
// • Poznámky („Moje výpočty“) patří k jedné úloze. Ukládá je app.js spolu
//   s konverzací, takže se synchronizují s rozpracovanou sadou.
// • Tahák patří k tématu a je stejný u všech jeho úloh. Předvyplní se
//   základními vzorci, žák si ho upraví. Ukládá se do localStorage a do
//   profilu (profiles.tahaky).
// • Obě pomůcky jdou vypnout v profilu (profiles.nastaveni).
//
// S app.js se propojí přes Pomucky.init(adaptéry).

const Pomucky = (() => {
  const NASTAVENI_KEY = 'matika_nastaveni';
  const TAHAKY_KEY    = 'matika_tahaky';
  const VYCHOZI_NASTAVENI = { poznamky: true, tahak: true };

  // Symboly, které na klávesnici chybí (vloží se na místo kurzoru)
  const SYMBOLY = ['²', '³', '√', '·', ':', '½', 'π', '≤', '≥', '≠', '≈', '°'];

  const VYCHOZI_TAHAKY = {
    procenta: `Základ = 100 %
1 % = základ : 100
Část = základ · p : 100
Zvýšení o p % → základ · (1 + p/100)
Snížení o p % → základ · (1 − p/100)
Po slevě 25 % platím 75 % původní ceny`,
    zlomky: `Sčítání a odčítání: nejdřív společný jmenovatel
Násobení: čitatel · čitatel, jmenovatel · jmenovatel
Dělení: násobím převráceným zlomkem
Krácení: čitatele i jmenovatele dělím stejným číslem
Smíšené číslo: 2 1/3 = 7/3`,
    rovnice: `Co udělám na jedné straně, udělám i na druhé
Zlomků se zbavím vynásobením společným jmenovatelem
Nerovnice: násobím/dělím záporným číslem → otočím znaménko
Soustava: metodu si vyberu sám
Zkouška: dosadím výsledek do zadání`,
    geometrie: `Pythagorova věta: c² = a² + b² (c = přepona)
Obvod kruhu: o = 2 · π · r
Obsah kruhu: S = π · r²
Obsah trojúhelníku: S = a · v : 2
Objem kvádru: V = a · b · c
Povrch kvádru: S = 2 · (ab + bc + ac)
π ≈ 3,14`,
    slovni: `1. Co hledám? → označím x
2. Ostatní údaje zapíšu pomocí x
3. Sestavím rovnici a vyřeším ji
4. Zkontroluju, že výsledek dává smysl
Pohyb: dráha = rychlost · čas`,
    grafy: `Průměr = součet hodnot : počet hodnot
Medián = prostřední hodnota (po seřazení)
Modus = nejčastější hodnota
Změna v % = (nová − stará) : stará · 100`
  };

  let _a = null;            // adaptéry z app.js
  let _temaTahaku = null;   // téma, jehož tahák je právě otevřený
  let _ulozTahakTimer = null;
  let _poznamkyTimer = null;

  const $ = id => document.getElementById(id);

  // ── Nastavení ─────────────────────────────────────────────────
  function nactiNastaveni() {
    try { return { ...VYCHOZI_NASTAVENI, ...JSON.parse(localStorage.getItem(_a.klicUzivatele(NASTAVENI_KEY)) || '{}') }; }
    catch { return { ...VYCHOZI_NASTAVENI }; }
  }
  function _zapisNastaveni(n) {
    try { localStorage.setItem(_a.klicUzivatele(NASTAVENI_KEY), JSON.stringify(n)); } catch {}
  }
  function ulozNastaveni(n) {
    const nove = { ...nactiNastaveni(), ...n };
    _zapisNastaveni(nove);
    Sync.ulozDoProfilu('nastaveni', nove);
    aplikujNastaveni();
  }
  function aplikujNastaveni() {
    const n = nactiNastaveni();
    $('pomucka-poznamky')?.classList.toggle('hidden', !n.poznamky);
    $('pomucka-tahak')?.classList.toggle('hidden', !n.tahak);
  }

  // ── Taháky ────────────────────────────────────────────────────
  function nactiTahaky() {
    try { return JSON.parse(localStorage.getItem(_a.klicUzivatele(TAHAKY_KEY)) || '{}'); } catch { return {}; }
  }
  function _zapisTahaky(t) {
    try { localStorage.setItem(_a.klicUzivatele(TAHAKY_KEY), JSON.stringify(t)); } catch {}
  }
  function _textTahaku(temaId) {
    const t = nactiTahaky()[temaId];
    return typeof t === 'string' ? t : (VYCHOZI_TAHAKY[temaId] || '');
  }
  function _ulozTahakHned() {
    clearTimeout(_ulozTahakTimer);
    _ulozTahakTimer = null;
    if (!_temaTahaku) return;
    const tahaky = nactiTahaky();
    const text = $('tahak-pole').value;
    if (tahaky[_temaTahaku] === text) return;
    tahaky[_temaTahaku] = text;
    _zapisTahaky(tahaky);
    Sync.ulozDoProfilu('tahaky', tahaky);
  }

  // ── Zobrazení u úlohy ─────────────────────────────────────────
  // Volá app.js při načtení každé úlohy
  function zobrazProUlohu(temaId, nazevTematu, poznamky = '') {
    _ulozTahakHned();   // rozepsaný tahák předchozího tématu neztrať
    $('poznamky-pole').value = poznamky || '';
    _temaTahaku = temaId;
    $('tahak-nazev').textContent = nazevTematu ? `· ${nazevTematu}` : '';
    $('tahak-pole').value = _textTahaku(temaId);
    $('btn-tahak-vychozi').classList.toggle('hidden', !VYCHOZI_TAHAKY[temaId]);
    aplikujNastaveni();
  }

  function getPoznamky() { return $('poznamky-pole')?.value || ''; }

  function vycisti() {
    _ulozTahakHned();
    $('poznamky-pole').value = '';
  }

  // Vloží text na místo kurzoru v textarea
  function _vlozDoPole(pole, text) {
    const zac = pole.selectionStart ?? pole.value.length;
    const kon = pole.selectionEnd ?? pole.value.length;
    pole.value = pole.value.slice(0, zac) + text + pole.value.slice(kon);
    pole.selectionStart = pole.selectionEnd = zac + text.length;
    pole.focus();
    pole.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Řádek, na kterém je kurzor (nebo vybraný text)
  function _aktualniRadek(pole) {
    const { selectionStart: zac, selectionEnd: kon, value } = pole;
    if (kon > zac) return value.slice(zac, kon).trim();
    const od = value.lastIndexOf('\n', zac - 1) + 1;
    const do_ = value.indexOf('\n', zac);
    return value.slice(od, do_ === -1 ? value.length : do_).trim();
  }

  function _lista(kontejner, pole) {
    kontejner.innerHTML = '';
    SYMBOLY.forEach(sym => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'symbol-btn';
      b.textContent = sym;
      b.setAttribute('aria-label', `Vložit ${sym}`);
      // mousedown: kurzor v poli zůstane na svém místě
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => _vlozDoPole(pole, sym));
      kontejner.appendChild(b);
    });
  }

  function init(adaptery) {
    _a = adaptery;
    const poznamky = $('poznamky-pole');
    const tahak    = $('tahak-pole');
    _lista($('poznamky-symboly'), poznamky);
    _lista($('tahak-symboly'), tahak);

    poznamky.addEventListener('input', () => {
      clearTimeout(_poznamkyTimer);
      _poznamkyTimer = setTimeout(() => _a.poznamkyZmeneny(), 800);
    });
    poznamky.addEventListener('blur', () => { clearTimeout(_poznamkyTimer); _a.poznamkyZmeneny(); });

    tahak.addEventListener('input', () => {
      clearTimeout(_ulozTahakTimer);
      _ulozTahakTimer = setTimeout(_ulozTahakHned, 1000);
    });
    tahak.addEventListener('blur', _ulozTahakHned);

    $('btn-poznamky-vlozit').addEventListener('click', () => {
      const radek = _aktualniRadek(poznamky);
      const zprava = $('poznamky-zprava');
      if (!radek) {
        zprava.textContent = 'Klikni do řádku, který chceš poslat koučovi.';
        zprava.classList.remove('hidden');
        return;
      }
      zprava.classList.add('hidden');
      _a.vlozDoOdpovedi(radek);
    });

    $('btn-tahak-vychozi').addEventListener('click', () => {
      if (!_temaTahaku || !VYCHOZI_TAHAKY[_temaTahaku]) return;
      if ($('tahak-pole').value !== VYCHOZI_TAHAKY[_temaTahaku]
          && !confirm('Vrátit tahák do původní podoby? Tvoje úpravy se smažou.')) return;
      $('tahak-pole').value = VYCHOZI_TAHAKY[_temaTahaku];
      _ulozTahakHned();
    });

    document.addEventListener('visibilitychange', () => { if (document.hidden) _ulozTahakHned(); });
  }

  // Adaptér pro Sync (profiles.nastaveni a profiles.tahaky)
  const profilObjekty = {
    nastaveni: { nacti: () => { try { return JSON.parse(localStorage.getItem(_a.klicUzivatele(NASTAVENI_KEY)) || '{}'); } catch { return {}; } },
                 zapis: n => { _zapisNastaveni(n); aplikujNastaveni(); } },
    tahaky:    { nacti: nactiTahaky,
                 zapis: t => { _zapisTahaky(t); if (_temaTahaku && document.activeElement !== $('tahak-pole')) $('tahak-pole').value = _textTahaku(_temaTahaku); } }
  };

  return { init, nactiNastaveni, ulozNastaveni, aplikujNastaveni, zobrazProUlohu, getPoznamky, vycisti, profilObjekty, VYCHOZI_TAHAKY };
})();
