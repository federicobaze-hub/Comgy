// ── Comgy — linkedin.js v8 ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── Auto sync: legge i post dalla pagina ──────────────────────────────────
  if (msg.action === 'sync_profile') {
    const posts = [];
    const seen = new Set();

    // Cerca SOLO nel contenuto principale — esclude sidebar
    const mainArea = document.querySelector('main, .scaffold-layout__main, [role="main"]')
      || document.body;

    // Cerca tutti i paragrafi con testo lungo nel contenuto principale
    const paras = mainArea.querySelectorAll('p');
    const postTexts = new Map(); // container → testo accumulato

    paras.forEach(p => {
      const txt = p.innerText?.trim() || '';
      if (txt.length < 60) return;

      // Risali al contenitore post (massimo 8 livelli)
      let container = p;
      for (let i = 0; i < 8; i++) {
        const parent = container.parentElement;
        if (!parent || parent === mainArea || parent === document.body) break;
        const parentTxt = parent.innerText?.trim() || '';
        if (parentTxt.length > 5000) break; // troppo grande = layout
        container = parent;
      }

      const fullTxt = container.innerText?.trim() || txt;
      const key = fullTxt.slice(0, 80);
      if (seen.has(key)) return;

      // Salta bio LinkedIn (contiene | multiple)
      const firstLine = fullTxt.split('\n')[0] || '';
      if ((firstLine.match(/\|/g) || []).length >= 2) return;

      // Salta testi troppo corti o troppo lunghi
      if (fullTxt.length < 120 || fullTxt.length > 6000) return;

      seen.add(key);

      // Cerca engagement
      const likesEl = container.querySelector('[aria-label*="reaction"], [class*="reaction-count"]');
      const commEl  = container.querySelector('[aria-label*="comment"], [class*="comment-count"]');
      const impressEl = container.querySelector('[class*="impressions"], [class*="view-count"]');

      posts.push({
        text: fullTxt,
        date: '',
        likes: parseInt((likesEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0,
        comments: parseInt((commEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0,
        impressions: parseInt((impressEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0,
        type: container.querySelector('video') ? 'video' : container.querySelector('img[class*="ivm"]') ? 'image' : 'text',
        url: window.location.href.split('?')[0]
      });
    });

    sendResponse({ posts: posts.slice(0, 25) });
    return true;
  }

  // ── Leggi post dal feed per commentare ───────────────────────────────────
  if (msg.action === 'get_post_text') {
    const center = window.innerHeight / 2;
    let bestText = '';
    let bestDist = Infinity;

    document.querySelectorAll('p').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) return;
      const txt = el.innerText?.trim() || '';
      if (txt.length < 50 || txt.length > 3000) return;
      const dist = Math.abs((rect.top + rect.height / 2) - center);
      if (dist < bestDist) { bestDist = dist; bestText = txt; }
    });

    sendResponse({ text: bestText });
    return true;
  }

  // ── Info profilo ──────────────────────────────────────────────────────────
  if (msg.action === 'get_profile_info') {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/(\d[\d.,]*)\s*(follower|seguac)/i);
    const followers = match ? parseInt(match[1].replace(/[.,]/g,'')) : 0;
    sendResponse({
      name: document.querySelector('h1')?.innerText?.trim() || '',
      followers,
      url: window.location.href.split('?')[0]
    });
    return true;
  }
});
