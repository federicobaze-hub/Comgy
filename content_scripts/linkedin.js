// ── Comgy — linkedin.js v6 ────────────────────────────────────────────────────

let captureMode = false;
let capturedPosts = [];
let overlay = null;

// ── Attiva modalità cattura ───────────────────────────────────────────────────
function activateCaptureMode() {
  captureMode = true;

  // Banner in cima alla pagina
  overlay = document.createElement('div');
  overlay.id = 'comgy-capture-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
    background: #00c896; color: #000; text-align: center;
    padding: 12px; font-family: monospace; font-size: 13px; font-weight: 700;
    letter-spacing: 0.06em; cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,200,150,0.4);
  `;
  overlay.textContent = `🎯 MODALITÀ CATTURA ATTIVA — Clicca su un post per salvarlo (${capturedPosts.length} salvati) — Clicca qui per uscire`;
  overlay.addEventListener('click', deactivateCaptureMode);
  document.body.appendChild(overlay);

  // Highlight al hover sui post
  document.addEventListener('mouseover', onHover);
  document.addEventListener('mouseout', onMouseOut);
  document.addEventListener('click', onClickPost, true);
}

function deactivateCaptureMode() {
  captureMode = false;
  if (overlay) { overlay.remove(); overlay = null; }
  document.removeEventListener('mouseover', onHover);
  document.removeEventListener('mouseout', onMouseOut);
  document.removeEventListener('click', onClickPost, true);
  // Rimuovi highlight rimasti
  document.querySelectorAll('[data-comgy-highlight]').forEach(el => {
    el.style.outline = '';
    el.style.cursor = '';
    delete el.dataset.comgyHighlight;
  });
}

function findPostParent(el) {
  // Risali nell'albero DOM fino a trovare un elemento che sembra un post
  let current = el;
  for (let i = 0; i < 10; i++) {
    if (!current || current === document.body) break;
    const txt = current.innerText?.trim() || '';
    // Un post ha almeno 80 caratteri e non è troppo grande
    if (txt.length >= 80 && txt.length <= 8000) {
      // Controlla che sia un "contenitore" plausibile
      const tag = current.tagName?.toLowerCase();
      if (['div', 'article', 'li', 'section'].includes(tag)) {
        return current;
      }
    }
    current = current.parentElement;
  }
  return null;
}

function onHover(e) {
  if (!captureMode) return;
  const post = findPostParent(e.target);
  if (post) {
    post.style.outline = '3px solid #00c896';
    post.style.cursor = 'pointer';
    post.dataset.comgyHighlight = 'true';
  }
}

function onMouseOut(e) {
  if (!captureMode) return;
  document.querySelectorAll('[data-comgy-highlight]').forEach(el => {
    el.style.outline = '';
    el.style.cursor = '';
    delete el.dataset.comgyHighlight;
  });
}

function onClickPost(e) {
  if (!captureMode) return;
  if (e.target === overlay || overlay?.contains(e.target)) return;

  e.preventDefault();
  e.stopPropagation();

  const post = findPostParent(e.target);
  if (!post) return;

  const text = post.innerText?.trim() || '';
  if (!text || text.length < 50) return;

  // Evita duplicati
  if (capturedPosts.find(p => p.text.slice(0,60) === text.slice(0,60))) {
    showFeedback(post, '⚠ Già salvato');
    return;
  }

  // Cerca like/commenti nel post
  const likesEl = post.querySelector('[aria-label*="reaction"], [class*="reaction-count"], [class*="social-counts__reactions"]');
  const commEl  = post.querySelector('[aria-label*="comment"], [class*="comment-count"], [class*="social-counts__comments"]');
  const likes    = parseInt((likesEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0;
  const comments = parseInt((commEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0;

  capturedPosts.push({ text, likes, comments, impressions: 0, type: 'text', date: '', url: window.location.href.split('?')[0] });

  // Aggiorna banner
  if (overlay) overlay.textContent = `🎯 MODALITÀ CATTURA ATTIVA — Clicca su un post per salvarlo (${capturedPosts.length} salvati) — Clicca qui per uscire`;

  showFeedback(post, `✓ Post #${capturedPosts.length} salvato!`);
}

function showFeedback(el, msg) {
  const fb = document.createElement('div');
  fb.style.cssText = `
    position: absolute; background: #00c896; color: #000;
    padding: 6px 14px; border-radius: 6px; font-size: 12px;
    font-weight: 700; font-family: monospace; z-index: 999998;
    pointer-events: none; top: 8px; right: 8px;
  `;
  fb.textContent = msg;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(fb);
  setTimeout(() => fb.remove(), 1800);
}

// ── Message listeners ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === 'start_capture') {
    capturedPosts = [];
    activateCaptureMode();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'get_captured') {
    deactivateCaptureMode();
    sendResponse({ posts: capturedPosts });
    capturedPosts = [];
    return true;
  }

  if (msg.action === 'get_post_text') {
    const center = window.innerHeight / 2;
    let bestText = '';
    let bestDist = Infinity;
    document.querySelectorAll('div, article, p').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight || rect.width < 100) return;
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
