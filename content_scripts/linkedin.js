// ── Comgy — linkedin.js v9 ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === 'sync_profile') {
    const posts = [];
    const seen = new Set();

    // Cerca SOLO elementi con data-urn (identificatore post LinkedIn)
    // oppure container specifici della pagina recent-activity
    const postSelectors = [
      '[data-urn*="ugcPost"]',
      '[data-urn*="activity"]', 
      '[data-id*="ugcPost"]',
      '[data-id*="activity"]',
      '.feed-shared-update-v2',
      '.profile-creator-shared-feed-update__container',
    ];

    let containers = [];
    for (const sel of postSelectors) {
      containers = [...document.querySelectorAll(sel)];
      if (containers.length > 0) break;
    }

    // Se ancora 0 — fallback: cerca paragrafi con testo lungo che contengono punteggiatura (post reali)
    if (containers.length === 0) {
      const paras = [...document.querySelectorAll('p')].filter(p => {
        const txt = p.innerText?.trim() || '';
        // Post reale: lungo, con punteggiatura, senza pipe
        return txt.length > 150 &&
               txt.includes('.') &&
               !txt.includes('|') &&
               !txt.toLowerCase().includes('area manager') &&
               !txt.toLowerCase().includes('consulente');
      });
      paras.forEach(p => {
        const txt = p.innerText.trim();
        const key = txt.slice(0, 80);
        if (seen.has(key)) return;
        seen.add(key);
        posts.push({ text: txt, date: '', likes: 0, comments: 0, impressions: 0, type: 'text', url: window.location.href.split('?')[0] });
      });
    } else {
      containers.forEach(c => {
        // Estrai solo il testo del post, non engagement
        const textEl = c.querySelector(
          '.feed-shared-update-v2__description, ' +
          '.update-components-text, ' +
          '[class*="commentary"], ' +
          'p'
        );
        const txt = (textEl?.innerText || c.innerText || '').trim().slice(0, 3000);
        if (!txt || txt.length < 80) return;
        if (txt.includes('|') && txt.split('\n')[0].includes('|')) return;
        const key = txt.slice(0, 80);
        if (seen.has(key)) return;
        seen.add(key);

        const likesEl = c.querySelector('[aria-label*="reaction"], [class*="reaction-count"]');
        const commEl  = c.querySelector('[aria-label*="comment"], [class*="comment-count"]');
        const impEl   = c.querySelector('[class*="impression"], [class*="view-count"]');

        posts.push({
          text: txt,
          date: '',
          likes: parseInt((likesEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0,
          comments: parseInt((commEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0,
          impressions: parseInt((impEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0,
          type: c.querySelector('video') ? 'video' : c.querySelector('img[class*="ivm"]') ? 'image' : 'text',
          url: window.location.href.split('?')[0]
        });
      });
    }

    sendResponse({ posts: posts.slice(0, 25) });
    return true;
  }

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

  if (msg.action === 'get_profile_info') {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/(\d[\d.,]*)\s*(follower|seguac)/i);
    const followers = match ? parseInt(match[1].replace(/[.,]/g,'')) : 0;
    sendResponse({ name: document.querySelector('h1')?.innerText?.trim() || '', followers, url: window.location.href.split('?')[0] });
    return true;
  }
});
