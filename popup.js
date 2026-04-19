// ── Comgy Extension v2 — popup.js ────────────────────────────────────────────

const DASHBOARD_URL = 'https://comgy.vercel.app';

// DOM refs
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const spinner    = document.getElementById('spinner');
const pageBadge  = document.getElementById('pageBadge');
const sectionSync    = document.getElementById('sectionSync');
const sectionComment = document.getElementById('sectionComment');

const syncResult = document.getElementById('syncResult');
const results    = document.getElementById('results');

// ── Storage helpers ───────────────────────────────────────────────────────────
function chromeGet(keys) {
  return new Promise(r => chrome.storage.local.get(keys, r)).then(res =>
    typeof keys === 'string' ? res[keys] : res
  );
}
function chromeSet(obj) { return new Promise(r => chrome.storage.local.set(obj, r)); }

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  if (url.includes('linkedin.com/in/')) {
    setStatus('on', 'Profilo rilevato');
    pageBadge.textContent = 'PROFILO';
    sectionSync.style.display = 'block';
  } else if (url.includes('linkedin.com')) {
    setStatus('on', 'LinkedIn rilevato');
    pageBadge.textContent = 'FEED';
    sectionComment.style.display = 'block';
  } else {
    setStatus('', 'Vai su LinkedIn per usare Comgy');
    pageBadge.textContent = '—';
  }

  // Mostra setup API key solo se non ancora salvata
}

function setStatus(type, text) {
  statusDot.className = 'dot' + (type === 'on' ? ' on' : type === 'err' ? ' err' : '');
  statusText.textContent = text;
}
function setLoading(on) { spinner.classList.toggle('on', on); }


// ── Sync profilo ──────────────────────────────────────────────────────────────
document.getElementById('btnSync').addEventListener('click', async () => {
  setLoading(true);
  document.getElementById('btnSync').disabled = true;
  syncResult.classList.remove('visible');
  setStatus('on', 'Lettura post in corso...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inietta content script
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content_scripts/linkedin.js'] });
    } catch(e) {}

    await new Promise(r => setTimeout(r, 1500));

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'sync_profile' });
    } catch(e) {
      syncResult.textContent = 'Errore: ricarica LinkedIn e riprova';
      syncResult.classList.add('visible');
      setLoading(false);
      document.getElementById('btnSync').disabled = false;
      return;
    }

    if (response?.posts?.length) {
      await chromeSet({ syncedPosts: response.posts, lastSync: Date.now() });

      try {
        const info = await chrome.tabs.sendMessage(tab.id, { action: 'get_profile_info' });
        if (info?.followers > 0) await chromeSet({ syncedFollowers: info.followers });
      } catch(e) {}

      const payload = encodeURIComponent(JSON.stringify({ posts: response.posts, lastSync: Date.now() }));
      chrome.tabs.create({ url: `${DASHBOARD_URL}?sync=${payload}` });

      syncResult.textContent = `✓ ${response.posts.length} post sincronizzati → Dashboard aperta`;
      syncResult.classList.add('visible');
      setStatus('on', `${response.posts.length} post in archivio`);
    } else {
      syncResult.textContent = 'Nessun post trovato — scorri il profilo e riprova';
      syncResult.classList.add('visible');
    }
  } catch(e) {
    syncResult.textContent = 'Errore: ' + e.message;
    syncResult.classList.add('visible');
    setStatus('err', 'Errore');
  }

  setLoading(false);
  document.getElementById('btnSync').disabled = false;
});

// ── Genera commento ───────────────────────────────────────────────────────────
document.getElementById('btnGenerate').addEventListener('click', async () => {
  const post = document.getElementById('postInput').value.trim();
  if (!post) { alert('Incolla un post prima.'); return; }

  const { apiKey, profile } = await chromeGet(['apiKey', 'profile']);
  if (!apiKey) { chrome.tabs.create({ url: DASHBOARD_URL }); return; }

  const btn = document.getElementById('btnGenerate');
  btn.disabled = true;
  btn.textContent = 'GENERANDO...';
  results.innerHTML = '';

  const memory = await chromeGet('memory') || [];
  const memSection = memory.length >= 5
    ? `\n[STILE APPRESO — ${memory.length} esempi]\n${memory.slice(0,8).map((m,i) => `${i+1}. "${m.text}"`).join('\n')}\n`
    : profile?.example ? `\n[SEED STILE]\n"${profile.example}"\n` : '';

  const prompt = `Sei ${profile?.role || 'un professionista LinkedIn'}.
Tono: ${profile?.tones?.join(', ') || 'diretto e naturale'}.
${memSection}

Post LinkedIn da commentare:
---
${post}
---

Genera ESATTAMENTE 3 commenti, uno per tipo:
1. type="professional" — Costruttivo, porta valore concreto sul tema del post
2. type="question" — Domanda genuina e specifica nata dalla lettura del post
3. type="insight" — Prospettiva aggiuntiva che arricchisce la discussione

Regole: rispondi al contenuto specifico del post, italiano naturale, zero emoji, zero hashtag, max 55 parole per commento.
JSON only: {"comments":[{"type":"professional","text":"..."},{"type":"question","text":"..."},{"type":"insight","text":"..."}]}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const raw = (data.content || []).map(b => b.text || '').join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const required = ['professional', 'question', 'insight'];
    const final = required.map(type => parsed.comments.find(c => c.type === type) || { type, text: parsed.comments[0]?.text || '—' });
    renderComments(final);
  } catch(e) {
    results.innerHTML = `<div style="padding:10px 16px;color:#ff4455;font-size:11px;font-family:monospace">ERR: ${e.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = 'GENERA';
});

// ── Render commenti ───────────────────────────────────────────────────────────
function renderComments(comments) {
  results.innerHTML = '';
  const meta = {
    professional: { l:'PROFESSIONALE', c:'tag-pro' },
    question:     { l:'DOMANDA', c:'tag-q' },
    insight:      { l:'INSIGHT', c:'tag-ins' },
  };
  comments.forEach(c => {
    const m = meta[c.type] || { l: c.type.toUpperCase(), c: 'tag-pro' };
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.text = c.text;
    card.innerHTML = `
      <div class="card-top">
        <span class="tag ${m.c}">${m.l}</span>
        <button class="copy-btn">COPIA</button>
      </div>
      <div class="card-text">${c.text}</div>`;
    results.appendChild(card);
  });
}

results.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  const text = btn.closest('.card').dataset.text;
  await navigator.clipboard.writeText(text);
  const mem = (await chromeGet('memory')) || [];
  if (!mem.find(m => m.text === text)) {
    mem.unshift({ text, ts: Date.now() });
    await chromeSet({ memory: mem.slice(0, 30) });
  }
  btn.textContent = '✓';
  setTimeout(() => btn.textContent = 'COPIA', 1600);
});

// ── API Key management ────────────────────────────────────────────────────────
async function initApiKey() {
  // Non mostrare automaticamente — solo via impostazioni
}

document.getElementById('btnSaveKey').addEventListener('click', async () => {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key || key.length < 20) { alert('Chiave non valida.'); return; }
  await chromeSet({ apiKey: key });
  document.getElementById('sectionApiKey').style.display = 'none';
  document.getElementById('apiKeyInput').value = '';
  alert('✓ API key salvata!');
});

// ── Bottoni footer ────────────────────────────────────────────────────────────
document.getElementById('btnOpenDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

document.getElementById('btnSettings').addEventListener('click', async () => {
  const sec = document.getElementById('sectionApiKey');
  const { apiKey } = await chromeGet(['apiKey']);
  if (apiKey) document.getElementById('apiKeyInput').value = apiKey;
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
});

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
initApiKey();
