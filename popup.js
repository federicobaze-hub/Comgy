// ── Comgy Extension v2 — popup.js ────────────────────────────────────────────

const DASHBOARD_URL = 'https://comgy.vercel.app'; // cambia con URL reale

// DOM
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const spinner    = document.getElementById('spinner');
const pageBadge  = document.getElementById('pageBadge');
const sectionSync    = document.getElementById('sectionSync');
const sectionComment = document.getElementById('sectionComment');
const syncResult = document.getElementById('syncResult');
const results    = document.getElementById('results');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  if (url.includes('linkedin.com/in/') && isOwnProfile(url)) {
    setStatus('on', 'Profilo rilevato');
    pageBadge.textContent = 'PROFILO';
    sectionSync.style.display = 'block';
  } else if (url.includes('linkedin.com/feed') || url.includes('linkedin.com/posts') || url.includes('linkedin.com/in/')) {
    setStatus('on', 'LinkedIn rilevato');
    pageBadge.textContent = 'FEED';
    sectionComment.style.display = 'block';
  } else if (url.includes('linkedin.com')) {
    setStatus('on', 'LinkedIn');
    pageBadge.textContent = 'LINKEDIN';
    sectionSync.style.display = 'block';
    sectionComment.style.display = 'block';
  } else {
    setStatus('', 'Vai su LinkedIn per usare Comgy');
    pageBadge.textContent = '—';
  }
}

function isOwnProfile(url) {
  // Consideriamo profilo qualsiasi /in/ page per ora
  return url.includes('/in/');
}

function setStatus(type, text) {
  statusDot.className = 'dot' + (type === 'on' ? ' on' : type === 'err' ? ' err' : '');
  statusText.textContent = text;
}

function setLoading(on) {
  spinner.classList.toggle('on', on);
}

// ── Sync profilo ──────────────────────────────────────────────────────────────
document.getElementById('btnSync').addEventListener('click', async () => {
  setLoading(true);
  document.getElementById('btnSync').disabled = true;
  syncResult.classList.remove('visible');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'sync_profile' });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content_scripts/linkedin.js'] });
      await new Promise(r => setTimeout(r, 500));
      response = await chrome.tabs.sendMessage(tab.id, { action: 'sync_profile' });
    }

    if (response?.posts?.length) {
      // Salva post in storage
      const existing = await chromeGet('syncedPosts') || [];
      const merged = mergePosts(existing, response.posts);
      await chromeSet({ syncedPosts: merged, lastSync: Date.now() });

      syncResult.textContent = `✓ ${response.posts.length} post sincronizzati → Dashboard aggiornata`;
      syncResult.classList.add('visible');
      setStatus('on', `${merged.length} post in archivio`);
    } else {
      syncResult.textContent = 'Nessun post trovato — scorri il profilo e riprova';
      syncResult.classList.add('visible');
    }
  } catch(e) {
    syncResult.textContent = 'Errore sync: ' + e.message;
    syncResult.classList.add('visible');
    setStatus('err', 'Errore sincronizzazione');
  }

  setLoading(false);
  document.getElementById('btnSync').disabled = false;
});

function mergePosts(existing, newPosts) {
  const merged = [...existing];
  newPosts.forEach(p => {
    if (!merged.find(e => e.text === p.text || (e.url && e.url === p.url))) {
      merged.push({ ...p, syncedAt: Date.now() });
    }
  });
  return merged.slice(0, 100); // max 100 post
}

// ── Grab post dal feed ────────────────────────────────────────────────────────
document.getElementById('btnGrabPost').addEventListener('click', async () => {
  const btn = document.getElementById('btnGrabPost');
  btn.textContent = '_ LETTURA...';
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'get_post_text' });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content_scripts/linkedin.js'] });
      await new Promise(r => setTimeout(r, 400));
      response = await chrome.tabs.sendMessage(tab.id, { action: 'get_post_text' });
    }
    if (response?.text) document.getElementById('postInput').value = response.text;
    else document.getElementById('postInput').placeholder = 'Nessun testo — incolla manualmente';
  } catch { document.getElementById('postInput').placeholder = 'Errore — incolla manualmente'; }
  btn.textContent = '↑ LEGGI POST DALLA PAGINA';
  btn.disabled = false;
});

// ── Genera commento ───────────────────────────────────────────────────────────
document.getElementById('btnGenerate').addEventListener('click', async () => {
  const post = document.getElementById('postInput').value.trim();
  if (!post) { alert('Incolla un post prima.'); return; }

  const { apiKey, profile } = await chromeGet(['apiKey', 'profile']);
  if (!apiKey) { alert('Configura la API key nella dashboard.'); return; }

  const tone = document.getElementById('toneSelect').value;
  const btn  = document.getElementById('btnGenerate');

  btn.disabled = true;
  btn.textContent = 'GENERANDO...';
  results.innerHTML = '';

  const toneMap = {
    mix:      'Genera type="professional" + type="question" + type="insight"',
    expert:   'Genera 3 varianti type="professional"',
    question: 'Genera 3 varianti type="question"',
    insight:  'Genera 3 varianti type="insight"',
  };

  const memory = await chromeGet('memory') || [];
  const memSection = memory.length >= 5
    ? `\n[STILE APPRESO]\n${memory.slice(0,8).map((m,i) => `${i+1}. "${m.text}"`).join('\n')}\n`
    : profile?.example ? `\n[SEED]\n"${profile.example}"\n` : '';

  const prompt = `Sei ${profile?.role || 'un professionista LinkedIn'}.
${memSection}
Post da commentare:
---
${post}
---
${toneMap[tone]}
Regole: rispondi al contenuto del post, italiano naturale, zero emoji, zero hashtag, max 55 parole.
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
    renderComments(parsed.comments);
  } catch(e) {
    results.innerHTML = `<div style="padding:10px 16px;color:#ff4455;font-size:11px;font-family:monospace">ERR: ${e.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = 'GENERA';
});

// ── Render ────────────────────────────────────────────────────────────────────
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
  const mem = await chromeGet('memory') || [];
  if (!mem.find(m => m.text === text)) {
    mem.unshift({ text, ts: Date.now() });
    await chromeSet({ memory: mem.slice(0, 30) });
  }
  btn.textContent = '✓';
  setTimeout(() => btn.textContent = 'COPIA', 1600);
});

// ── Dashboard link ────────────────────────────────────────────────────────────
document.getElementById('btnOpenDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// ── Storage helpers ───────────────────────────────────────────────────────────
function chromeGet(keys) {
  return new Promise(r => chrome.storage.local.get(keys, r)).then(res =>
    typeof keys === 'string' ? res[keys] : res
  );
}
function chromeSet(obj) { return new Promise(r => chrome.storage.local.set(obj, r)); }

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
