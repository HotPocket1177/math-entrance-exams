// sync.js — synchronizace dat žáka mezi zařízeními přes Supabase (migrace 010)
//
// localStorage zůstává hlavním úložištěm — aplikace tak funguje i bez sítě.
// Po přihlášení se sloučí s účtem a každá změna se s malým zpožděním
// pošle na server:
//   • rozpracované sady i s konverzacemi → tabulka rozpracovane_sady
//     (novější verze vyhrává; sada smazaná jinde zmizí i tady)
//   • souhrnné statistiky → profiles.vysledky (přičítá se atomicky v DB)
//   • volba „Slovní úlohy / Jen příklady“ → profiles.typ_uloh
//   • nastavení pomůcek a taháky k tématům → profiles.nastaveni, profiles.tahaky (migrace 011)
//
// S app.js se propojí přes Sync.init(adaptéry) — klíče a formát dat zná app.js.

const Sync = (() => {
  const ZPOZDENI_MS = 1500;      // změny v rychlém sledu se pošlou najednou
  let _a = null;                 // adaptéry z app.js
  const _cekajici = new Map();   // sadaId → timeout odeslání

  function init(adaptery) { _a = adaptery; }

  const _sb  = () => Auth.getSupabase();
  const _uid = () => Auth.getSession()?.user?.id;

  // ── Rozpracované sady ─────────────────────────────────────────

  // Sady smazané tady, jejichž smazání se ještě nepovedlo poslat na server
  // (offline) — jinak by se při příští synchronizaci vrátily.
  const _smazaneKlic = () => _a.klicUzivatele('matika_sync_smazane');
  function _nactiSmazane() {
    try { return JSON.parse(localStorage.getItem(_smazaneKlic()) || '[]'); } catch { return []; }
  }
  function _zapisSmazane(ids) {
    try { localStorage.setItem(_smazaneKlic(), JSON.stringify([...new Set(ids)].slice(-100))); } catch {}
  }

  function _zabal(sada) {
    const konverzace = {};
    (sada.ulohy || []).forEach(u => {
      const raw = localStorage.getItem(_a.konvKlic(sada.sadaId, u.id));
      if (!raw) return;
      try { konverzace[u.id] = JSON.parse(raw); } catch {}
    });
    const { synchronizovano, ...meta } = sada;
    return { sada: meta, konverzace };
  }

  // Volá app.js po každém uložení sady
  function naplanujSadu(sadaId) {
    if (!_uid() || !sadaId) return;
    clearTimeout(_cekajici.get(sadaId));
    _cekajici.set(sadaId, setTimeout(() => { _cekajici.delete(sadaId); ulozSadu(sadaId); }, ZPOZDENI_MS));
  }

  // Pošle hned všechno, co čeká (tab se skrývá, žák odchází)
  function odesliHned() {
    [..._cekajici.keys()].forEach(sadaId => {
      clearTimeout(_cekajici.get(sadaId));
      _cekajici.delete(sadaId);
      ulozSadu(sadaId);
    });
  }

  async function ulozSadu(sadaId) {
    const uid = _uid();
    if (!uid) return;
    const sada = _a.nactiRozpracovane()[sadaId];
    if (!sada?.pokrok) return;   // sady bez pokroku se v panelu neukazují — nesynchronizujeme
    const { error } = await _sb().from('rozpracovane_sady').upsert({
      user_id:  uid,
      sada_id:  sadaId,
      data:     _zabal(sada),
      upraveno: new Date(sada.upraveno || Date.now()).toISOString()
    }, { onConflict: 'user_id,sada_id' });
    if (error) { console.warn('Synchronizace sady selhala:', error.message); return; }

    // Poznač, že sada je na serveru: když z něj později zmizí, byla smazána jinde
    const mapa = _a.nactiRozpracovane();
    if (mapa[sadaId] && !mapa[sadaId].synchronizovano) {
      mapa[sadaId].synchronizovano = true;
      _a.zapisRozpracovane(mapa);
    }
  }

  async function smazSadu(sadaId) {
    clearTimeout(_cekajici.get(sadaId));
    _cekajici.delete(sadaId);
    const uid = _uid();
    if (!uid || !sadaId) return;
    _zapisSmazane([..._nactiSmazane(), sadaId]);
    const { error } = await _sb().from('rozpracovane_sady').delete().eq('user_id', uid).eq('sada_id', sadaId);
    if (error) { console.warn('Smazání sady na serveru selhalo:', error.message); return; }
    _zapisSmazane(_nactiSmazane().filter(id => id !== sadaId));
  }

  // Sloučí sady ze serveru s lokálními. Vrací true, když se lokálně něco změnilo.
  async function stahniSady() {
    const uid = _uid();
    if (!uid) return false;

    // Nejdřív dořeš smazání, která se dřív nepovedla poslat
    const smazane = _nactiSmazane();
    if (smazane.length) {
      const { error } = await _sb().from('rozpracovane_sady').delete().eq('user_id', uid).in('sada_id', smazane);
      if (!error) _zapisSmazane([]);
    }

    const { data, error } = await _sb()
      .from('rozpracovane_sady')
      .select('sada_id, data, upraveno')
      .eq('user_id', uid);
    if (error) { console.warn('Načtení sad ze serveru selhalo:', error.message); return false; }

    const ignorovat = new Set(_nactiSmazane());
    const server = new Map((data || []).filter(r => !ignorovat.has(r.sada_id)).map(r => [r.sada_id, r]));
    const mapa = _a.nactiRozpracovane();
    let zmena = false;
    const nahrat = [];

    // Server → zařízení: chybějící nebo novější sady
    for (const [sadaId, r] of server) {
      const lokalni   = mapa[sadaId];
      const serverCas = Date.parse(r.upraveno);
      const { sada, konverzace } = r.data || {};
      if (!sada?.ulohy?.length) continue;
      if (!lokalni || (lokalni.upraveno || 0) < serverCas) {
        Object.entries(konverzace || {}).forEach(([ulohaId, k]) => {
          try { localStorage.setItem(_a.konvKlic(sadaId, ulohaId), JSON.stringify(k)); } catch {}
        });
        mapa[sadaId] = { ...sada, sadaId, upraveno: serverCas, synchronizovano: true };
        zmena = true;
      } else if ((lokalni.upraveno || 0) > serverCas) {
        nahrat.push(sadaId);   // tady je novější — pošli na server
      }
    }

    // Lokální sady, které na serveru nejsou
    for (const sada of Object.values(mapa)) {
      if (server.has(sada.sadaId) || !sada.pokrok) continue;
      if (sada.synchronizovano) {
        _a.smazSaduZMapy(mapa, sada.sadaId);   // byla na serveru → smazaná na jiném zařízení
        zmena = true;
      } else {
        nahrat.push(sada.sadaId);              // ještě nikdy neodeslaná (např. před zavedením synchronizace)
      }
    }

    if (zmena) _a.zapisRozpracovane(mapa);
    await Promise.all(nahrat.map(ulozSadu));
    return zmena;
  }

  // ── Statistiky a volba typu úloh ──────────────────────────────

  function zapisVysledek(temaId, uspech) {
    if (!_uid()) return;
    _sb().rpc('zapis_vysledek', { p_tema: temaId, p_uspech: !!uspech })
      .then(({ error }) => { if (error) console.warn('Synchronizace výsledku selhala:', error.message); });
  }

  function ulozTypy(typy) {
    const uid = _uid();
    if (!uid) return;
    _sb().from('profiles').update({ typ_uloh: typy }).eq('id', uid)
      .then(({ error }) => { if (error) console.warn('Synchronizace volby typu úloh selhala:', error.message); });
  }

  // Obecné uložení objektu do sloupce profilu (nastaveni, tahaky)
  function ulozDoProfilu(sloupec, hodnota) {
    const uid = _uid();
    if (!uid) return;
    _sb().from('profiles').update({ [sloupec]: hodnota }).eq('id', uid)
      .then(({ error }) => { if (error) console.warn(`Synchronizace ${sloupec} selhala:`, error.message); });
  }

  // Objekty v profilu, které zná app.js přes adaptér profilObjekty: { sloupec: { nacti, zapis } }.
  // Server má přednost po klíčích, co na serveru chybí, doplní zařízení.
  // Samostatný dotaz — když migrace 011 ještě neproběhla, ostatní synchronizace jede dál.
  async function stahniProfiloveObjekty(uid) {
    const objekty = _a.profilObjekty || {};
    const sloupce = Object.keys(objekty);
    if (!sloupce.length) return false;
    const { data, error } = await _sb().from('profiles').select(sloupce.join(', ')).eq('id', uid).maybeSingle();
    if (error) { console.warn('Načtení nastavení a taháků selhalo:', error.message); return false; }
    let zmena = false;
    for (const sloupec of sloupce) {
      const lokalni = objekty[sloupec].nacti();
      const server  = data?.[sloupec] || {};
      const spojene = { ...lokalni, ...server };
      if (JSON.stringify(spojene) !== JSON.stringify(lokalni)) { objekty[sloupec].zapis(spojene); zmena = true; }
      if (JSON.stringify(spojene) !== JSON.stringify(server)) ulozDoProfilu(sloupec, spojene);
    }
    return zmena;
  }

  // Statistiky: u každého tématu platí vyšší čísla (server × zařízení).
  // Volba typu úloh: server má přednost, co na serveru chybí, doplní zařízení.
  async function stahniProfil() {
    const uid = _uid();
    if (!uid) return false;
    let zmena = false;

    const lokalniVysledky = _a.nactiVysledky();
    const { data: vysledky, error: e1 } = await _sb().rpc('sluc_vysledky', { p_vysledky: lokalniVysledky });
    if (e1) console.warn('Synchronizace statistik selhala:', e1.message);
    else if (vysledky && JSON.stringify(vysledky) !== JSON.stringify(lokalniVysledky)) {
      _a.zapisVysledky(vysledky);
      zmena = true;
    }

    if (await stahniProfiloveObjekty(uid)) zmena = true;

    const { data: profil, error: e2 } = await _sb().from('profiles').select('typ_uloh').eq('id', uid).maybeSingle();
    if (e2) { console.warn('Načtení volby typu úloh selhalo:', e2.message); return zmena; }
    const lokalniTypy = _a.nactiTypy();
    const spojene = { ...lokalniTypy, ...(profil?.typ_uloh || {}) };
    if (JSON.stringify(spojene) !== JSON.stringify(lokalniTypy)) { _a.zapisTypy(spojene); zmena = true; }
    if (JSON.stringify(spojene) !== JSON.stringify(profil?.typ_uloh || {})) ulozTypy(spojene);
    return zmena;
  }

  // Po přihlášení (a po návratu do aplikace). Nikdy nevyhodí chybu.
  async function stahniVse() {
    try {
      const [a, b] = await Promise.all([stahniSady(), stahniProfil()]);
      return a || b;
    } catch (e) {
      console.warn('Synchronizace selhala:', e.message);
      return false;
    }
  }

  return { init, naplanujSadu, odesliHned, ulozSadu, smazSadu, stahniSady, stahniProfil, stahniVse, zapisVysledek, ulozTypy, ulozDoProfilu };
})();
