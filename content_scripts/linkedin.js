// ── Comgy — linkedin.js v4 ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── Sync: legge tutto il testo visibile e cerca post ─────────────────────
  if (msg.action === 'sync_profile') {
    const posts = [];
    const seen = new Set();

    // Metodo 1: cerca elementi con testo lungo (post tipici 100-3000 chars)
    const allEls = document.querySelectorAll('p, div, span, article');
    const candidates = [];

    allEls.forEach(el => {
      // Solo elementi diretti senza figli con testo (evita duplicati)
      const directText = [...el.childNodes]
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent.trim())
        .join(' ')
        .trim();

      if (directText.length > 100 && directText.length < 3000) {
        candidates.push(directText);
      }
    });

    // Metodo 2: prende tutti i testi lunghi da innerText escludendo navigazione
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 80);

    // Raggruppa righe consecutive in post
    let currentPost = '';
    lines.forEach(line => {
      // Skip righe di navigazione tipiche di LinkedIn
      if (['Home', 'Rete', 'Lavoro', 'Messaggi', 'Notifiche', 'Cerca', 'Premium', 'Seguaci', 'Collegati', 'Follower'].some(w => line === w)) return;
      if (line.length < 30 && currentPost.length > 100) {
        if (!seen.has(currentPost.slice(0, 50))) {
          seen.add(currentPost.slice(0, 50));
          posts.push({
            text: currentPost.trim(),
            date: '',
            likes: 0,
            comments: 0,
            impressions: 0,
            type: 'text',
            url: window.location.href.split('?')[0]
          });
        }
        currentPost = '';
      } else {
        currentPost += (currentPost ? ' ' : '') + line;
      }
    });
    // Ultimo post
    if (currentPost.length > 100 && !seen.has(currentPost.slice(0, 50))) {
      posts.push({ text: currentPost.trim(), date: '', likes: 0, comments: 0, impressions: 0, type: 'text', url: window.location.href.split('?')[0] });
    }

    // Se ancora 0, usa metodo brute force
    if (posts.length === 0) {
      candidates.slice(0, 20).forEach(text => {
        if (!seen.has(text.slice(0, 50))) {
          seen.add(text.slice(0, 50));
          posts.push({ text, date: '', likes: 0, comments: 0, impressions: 0, type: 'text', url: window.location.href.split('?')[0] });
        }
      });
    }

    sendResponse({ posts: posts.slice(0, 30) });
    return true;
  }

  // ── Leggi post singolo dal feed ───────────────────────────────────────────
  if (msg.action === 'get_post_text') {
    // Prende il testo più lungo visibile nella pagina che sembra un post
    let bestText = '';
    const allEls = document.querySelectorAll('p, div[class*="update"], div[class*="feed"], article');
    allEls.forEach(el => {
      const txt = el.innerText?.trim() || '';
      if (txt.length > bestText.length && txt.length < 3000 && txt.length > 50) {
        bestText = txt;
      }
    });
    sendResponse({ text: bestText });
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
