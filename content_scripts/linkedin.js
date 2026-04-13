// ── Comgy — linkedin.js v7 ─── inject save buttons ───────────────────────────

let capturedPosts = [];
let injected = false;

function injectSaveButtons() {
  if (injected) return;
  injected = true;

  // Banner info
  const banner = document.createElement('div');
  banner.id = 'comgy-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#00c896;color:#000;text-align:center;padding:10px;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:0.06em;';
  banner.id = 'comgy-banner';
  updateBanner(banner);
  document.body.appendChild(banner);

  // Cerca post con testo lungo
  scanAndInject();

  // Ogni 2 secondi cerca nuovi post (scroll lazy load)
  const interval = setInterval(() => {
    if (!document.getElementById('comgy-banner')) {
      clearInterval(interval);
      return;
    }
    scanAndInject();
  }, 2000);
}

function updateBanner(el) {
  const b = el || document.getElementById('comgy-banner');
  if (b) b.textContent = `🎯 COMGY — Clicca 💾 per salvare un post (${capturedPosts.length} salvati) — poi torna sul popup`;
}

function scanAndInject() {
  // Trova tutti i paragrafi con testo lungo che non hanno già il bottone
  const paras = document.querySelectorAll('p, span[dir="ltr"]');
  paras.forEach(p => {
    const txt = p.innerText?.trim() || '';
    if (txt.length < 100) return;
    if (p.dataset.comgyDone) return;
    p.dataset.comgyDone = 'true';

    const btn = document.createElement('button');
    btn.textContent = '💾';
    btn.title = 'Salva in Comgy';
    btn.style.cssText = 'display:inline-block;margin-left:8px;background:#00c896;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:14px;vertical-align:middle;flex-shrink:0;';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Prende il testo dal contenitore più ampio
      const container = p.closest('div[class], article') || p.parentElement;
      const fullText = container?.innerText?.trim() || txt;
      const key = fullText.slice(0, 80);
      if (capturedPosts.find(c => c.text.slice(0, 80) === key)) {
        btn.textContent = '✓';
        btn.style.background = '#888';
        return;
      }
      capturedPosts.push({ text: fullText, likes: 0, comments: 0, impressions: 0, type: 'text', date: '', url: window.location.href.split('?')[0] });
      btn.textContent = '✓';
      btn.style.background = '#00a070';
      updateBanner();
    });
    p.parentElement?.insertBefore(btn, p.nextSibling);
  });
}

function removeSaveButtons() {
  document.querySelectorAll('#comgy-banner').forEach(e => e.remove());
  document.querySelectorAll('button[title="Salva in Comgy"]').forEach(e => e.remove());
  document.querySelectorAll('[data-comgy-done]').forEach(e => delete e.dataset.comgyDone);
  injected = false;
}

// ── Message listeners ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === 'start_capture') {
    capturedPosts = [];
    injectSaveButtons();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'get_captured') {
    const posts = [...capturedPosts];
    removeSaveButtons();
    capturedPosts = [];
    sendResponse({ posts });
    return true;
  }

  if (msg.action === 'get_post_text') {
    const center = window.innerHeight / 2;
    let bestText = '';
    let bestDist = Infinity;
    document.querySelectorAll('p, span[dir="ltr"]').forEach(el => {
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
    const followers = match ? parseInt(match[1].replace(/[.,]/g, '')) : 0;
    sendResponse({ name: document.querySelector('h1')?.innerText?.trim() || '', followers, url: window.location.href.split('?')[0] });
    return true;
  }
});
