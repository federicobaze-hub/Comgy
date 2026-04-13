// ── Comgy — linkedin.js v5 ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── Sync post dal profilo ─────────────────────────────────────────────────
  if (msg.action === 'sync_profile') {
    const posts = [];
    const seen = new Set();

    // Lista parole singole da saltare (righe di navigazione)
    const NAV = new Set(['home','rete','lavoro','messaggi','notifiche','cerca',
      'premium','seguaci','follower','connessioni','impostazioni','altro',
      'accessibilità','pubblicità','consigliato','mi piace','commenta',
      'condividi','invia','diffondi','seguire','collegati']);

    const body = document.body.innerText || '';

    // Divide per doppio a capo — ogni blocco è un potenziale post
    const blocks = body.split(/\n{2,}/);

    blocks.forEach(raw => {
      const text = raw.trim();
      if (text.length < 120 || text.length > 5000) return;

      // Salta se è solo navigazione (tutte le righe sono parole nav)
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const navLines = lines.filter(l => NAV.has(l.toLowerCase()) || l.length < 4);
      if (navLines.length > lines.length * 0.5) return;

      // Salta se contiene pipe (tipico delle bio LinkedIn: "Ruolo | Azienda")
      const firstLine = lines[0] || '';
      if ((firstLine.match(/\|/g) || []).length >= 2) return;

      // Dedup
      const key = text.slice(0, 80);
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

    sendResponse({ posts: posts.slice(0, 20) });
    return true;
  }

  // ── Leggi post più vicino al centro del viewport ───────────────────────────
  if (msg.action === 'get_post_text') {
    const center = window.innerHeight / 2;
    let bestText = '';
    let bestDist = Infinity;

    // Prova prima selettori specifici LinkedIn
    const selectors = [
      '.feed-shared-update-v2',
      'div[data-urn*="activity"]',
      'div[class*="occludable-update"]',
      'article',
    ];

    let cards = [];
    for (const sel of selectors) {
      cards = [...document.querySelectorAll(sel)];
      if (cards.length > 0) break;
    }

    cards.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height < 10) return;
      const dist = Math.abs((rect.top + rect.height / 2) - center);
      const txt = el.innerText?.trim() || '';
      if (txt.length > 50 && dist < bestDist) {
        bestDist = dist;
        bestText = txt;
      }
    });

    // Fallback: paragrafi visibili nel viewport
    if (!bestText) {
      document.querySelectorAll('p').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) return;
        const txt = el.innerText?.trim() || '';
        const dist = Math.abs((rect.top + rect.height / 2) - center);
        if (txt.length > 50 && dist < bestDist) {
          bestDist = dist;
          bestText = txt;
        }
      });
    }

    sendResponse({ text: bestText });
    return true;
  }

  // ── Info profilo ──────────────────────────────────────────────────────────
  if (msg.action === 'get_profile_info') {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/(\d[\d.,]*)\s*(follower|seguac)/i);
    const followers = match ? parseInt(match[1].replace(/[.,]/g, '')) : 0;
    const nameEl = document.querySelector('h1');
    sendResponse({ name: nameEl?.innerText?.trim() || '', followers, url: window.location.href.split('?')[0] });
    return true;
  }
});
