// ── Comgy — linkedin.js v4 ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── Sync: legge tutto il testo visibile e cerca post ─────────────────────
  if (msg.action === 'sync_profile') {
    const posts = [];
    const seen = new Set();

    // Pattern da escludere — bio, navigazione, UI LinkedIn
    const SKIP_PATTERNS = [
      /^home$/i, /^rete$/i, /^lavoro$/i, /^messaggi$/i, /^notifiche$/i,
      /^cerca$/i, /^premium$/i, /^seguaci/i, /^follower/i, /^connessioni/i,
      /^visualizza profilo/i, /^impostazioni/i, /^linkedin corporation/i,
      /^mi piace/i, /^commenta/i, /^condividi/i, /^invia/i, /^vedi altro/i,
      /^ottieni/i, /^scarica l'app/i, /^centro assistenza/i,
      // Bio LinkedIn tipica: "Ruolo | Azienda | Descrizione"
      /^[A-Z][^.!?]{0,60}\|[^.!?]{0,60}\|/,
      /manager.*\|.*cybersecurity/i,
      /consulente.*cybersecurity/i,
    ];

    function shouldSkip(text) {
      if (text.length < 80 || text.length > 4000) return true;
      const lower = text.toLowerCase();
      return SKIP_PATTERNS.some(p => p.test(text)) ||
             // Salta testi senza punteggiatura (tipici di bio/nav)
             (text.split(/[.!?,]/).length < 2 && text.length < 200);
    }

    // Leggi il body e cerca blocchi di testo che sembrano post
    const bodyText = document.body.innerText || '';
    const blocks = bodyText.split(/\n{2,}/); // divide per doppio a capo

    blocks.forEach(block => {
      const text = block.trim();
      if (text.length < 80 || text.length > 4000) return;
      if (shouldSkip(text)) return;
      const key = text.slice(0, 60);
      if (seen.has(key)) return;
      seen.add(key);

      posts.push({
        text,
        date: '',
        likes: 0,
        comments: 0,
        impressions: 0,
        type: 'text',
        url: window.location.href.split('?')[0]
      });
    });

    sendResponse({ posts: posts.slice(0, 30) });
    return true;
  }

  // ── Leggi post singolo dal feed ───────────────────────────────────────────
  if (msg.action === 'get_post_text') {
    // Trova il post più centrato nel viewport
    const viewportCenter = window.innerHeight / 2;
    let bestEl = null;
    let bestScore = Infinity;

    const candidates = document.querySelectorAll(
      '.feed-shared-update-v2, ' +
      'div[data-urn*="activity"], ' +
      'div[class*="occludable-update"], ' +
      'article, ' +
      '.scaffold-finite-scroll__content > div > div'
    );

    candidates.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const elCenter = rect.top + rect.height / 2;
      const dist = Math.abs(elCenter - viewportCenter);
      if (dist < bestScore) {
        bestScore = dist;
        bestEl = el;
      }
    });

    let text = bestEl?.innerText?.trim() || '';

    // Fallback: prende tutti i paragrafi visibili e trova il blocco più centrato
    if (!text || text.length < 30) {
      const allP = [...document.querySelectorAll('p, span[dir="ltr"]')];
      let bestP = null;
      let bestDist = Infinity;
      allP.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) return;
        if (rect.width === 0) return;
        const dist = Math.abs((rect.top + rect.height / 2) - viewportCenter);
        const txt = el.innerText?.trim() || '';
        if (txt.length > 50 && dist < bestDist) {
          bestDist = dist;
          bestP = txt;
        }
      });
      text = bestP || '';
    }

    sendResponse({ text });
    return true;
  }

  // ── Info profilo ──────────────────────────────────────────────────────────
  if (msg.action === 'get_profile_info') {
    let followers = 0;
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/(\d[\d.,]*)\s*follower/i);
    if (match) followers = parseInt(match[1].replace(/[.,]/g, ''));

    const nameEl = document.querySelector('h1');
    sendResponse({ name: nameEl?.innerText?.trim() || '', followers, url: window.location.href.split('?')[0] });
    return true;
  }
});
