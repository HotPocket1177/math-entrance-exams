// math-render.js — KaTeX helper: renderování LaTeXu v DOM prvcích

const MathRender = (() => {

  // Zkontroluj, zda je KaTeX dostupný (načtený z CDN)
  function jeKatexDostupny() {
    return typeof katex !== 'undefined' && typeof renderMathInElement !== 'undefined';
  }

  // ── renderMath(element) ───────────────────────────────────────
  // Projde daný DOM element a renderuje KaTeXem všechny $...$ a $$...$$.
  // Bezpečně selže pokud KaTeX není načten.
  function renderMath(element) {
    if (!element || !jeKatexDostupny()) return;
    try {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true  },
          { left: '$',  right: '$',  display: false }
        ],
        throwOnError: false,
        errorColor: 'var(--color-danger)',
        output: 'html'
      });
    } catch (e) {
      // KaTeX selhalo — necháme plain text
      console.warn('KaTeX render error:', e.message);
    }
  }

  // ── renderStep(text) → HTML string ───────────────────────────
  // Renderuje jeden krok do HTML stringu pro výpočetní panel.
  // Pokud text obsahuje $...$, použije KaTeX.
  // Jinak vrátí escapovaný plain text.
  function renderStep(text) {
    if (!text) return '';
    if (!jeKatexDostupny() || !text.includes('$')) {
      return escapuj(text);
    }

    // Rozlož text na části: text | $latex$ | $$latex$$
    let result = '';
    let zbyvajici = text;

    // Nejdřív $$...$$ (display), pak $...$ (inline)
    const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
    let lastIndex = 0;
    let match;

    re.lastIndex = 0;
    while ((match = re.exec(text)) !== null) {
      // Text před match
      result += escapuj(text.slice(lastIndex, match.index));

      const raw = match[0];
      const isDisplay = raw.startsWith('$$');
      const latex = isDisplay ? raw.slice(2, -2) : raw.slice(1, -1);

      try {
        result += katex.renderToString(latex, {
          throwOnError: false,
          displayMode: isDisplay,
          output: 'html'
        });
      } catch {
        result += escapuj(raw);
      }

      lastIndex = match.index + raw.length;
    }
    // Zbývající text za poslední shodou
    result += escapuj(text.slice(lastIndex));
    return result;
  }

  function escapuj(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { renderMath, renderStep };
})();
