// engine.js — Sokratovský dialog engine (state machine)

const Engine = (() => {
  // Stav aktuální úlohy
  let stav = {
    uloha: null,       // objekt úlohy
    krok: 0,           // index aktuálního kroku (nápovědy)
    dokonceno: false,
    pocetPokusu: 0,
    zobrazenaOdpoved: false
  };

  // Inicializace nové úlohy
  function inicializuj(uloha) {
    stav = {
      uloha: uloha,
      krok: 0,
      dokonceno: false,
      pocetPokusu: 0,
      zobrazenaOdpoved: false
    };
    return {
      typ: 'system',
      text: uloha.zadani,
      otazka: uloha.kroky[0]
    };
  }

  // Vyhodnotí vstup od žáka
  // Vrací objekt: { typ, text, napoveda?, dalsiMozna?, hotovo? }
  function vyhodnotVstup(vstup) {
    if (!stav.uloha) return null;
    if (stav.dokonceno) return { typ: 'info', text: 'Úloha je již dokončena. Přejdi na další.' };

    vstup = vstup.trim();
    if (!vstup) return { typ: 'chyba', text: 'Napiš prosím svou odpověď.' };

    stav.pocetPokusu++;

    const spravne = stav.uloha.kontrola(vstup);

    if (spravne) {
      stav.dokonceno = true;
      return {
        typ: 'uspech',
        text: `Správně! ${stav.uloha.odpoved}`,
        hotovo: true
      };
    }

    // Odpověď je špatná
    const zbyvajiciKroky = stav.uloha.kroky.length;
    const dalsiKrok = stav.krok + 1;

    if (dalsiKrok < zbyvajiciKroky) {
      stav.krok = dalsiKrok;
      return {
        typ: 'napoveda',
        text: 'Zkus to znovu. Tady je nápověda:',
        napoveda: stav.uloha.kroky[dalsiKrok]
      };
    }

    // Nápovědy došly
    if (!stav.zobrazenaOdpoved) {
      stav.zobrazenaOdpoved = true;
      stav.dokonceno = true;
      return {
        typ: 'reseni',
        text: `Nevadí, tady je správné řešení: ${stav.uloha.odpoved}`,
        hotovo: true,
        bodovaZtrata: true
      };
    }

    return {
      typ: 'info',
      text: 'Tato úloha je vyřešena. Přejdi na další.',
      hotovo: true
    };
  }

  function getStav() {
    return { ...stav };
  }

  function jeDokonceno() {
    return stav.dokonceno;
  }

  function aktualniKrok() {
    return stav.krok;
  }

  return { inicializuj, vyhodnotVstup, getStav, jeDokonceno, aktualniKrok };
})();
