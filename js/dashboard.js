// ── Comgy Dashboard v2 — dashboard.js ────────────────────────────────────────

// ── Storage ───────────────────────────────────────────────────────────────────
const S = {
  get: k => { try { return JSON.parse(localStorage.getItem('comgy_' + k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem('comgy_' + k, JSON.stringify(v)),
  del: k => localStorage.removeItem('comgy_' + k),
};

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  profile: null,
  apiKey: null,
  posts: [],
  memory: [],
};

// ── LEVELS ────────────────────────────────────────────────────────────────────
const LEVELS = [
  { min:0,  max:4,  name:'APPRENDISTA' },
  { min:5,  max:9,  name:'IN EVOLUZIONE' },
  { min:10, max:19, name:'CALIBRATO' },
  { min:20, max:29, name:'CONSOLIDATO' },
  { min:30, max:999,name:'TUA VOCE' },
];
function getLevel(n) { return LEVELS.find(l => n >= l.min && n <= l.max) || LEVELS[0]; }

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  initChips();
  state.apiKey  = S.get('apiKey');
  state.profile = S.get('profile');
  state.posts   = S.get('syncedPosts') || [];
  state.memory  = S.get('memory') || [];

  if (!state.apiKey || !state.profile) {
    showScreen('setup');
    return;
  }

  showScreen('dashboard');
  renderAll();
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navTo(screen, el) {
  // Sidebar active
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  // Mobile nav active
  document.querySelectorAll('.mob-item').forEach(i => i.classList.remove('active'));
  const mob = document.querySelector(`.mob-item[data-screen="${screen}"]`);
  if (mob) mob.classList.add('active');

  const titles = { dashboard:'Dashboard', growth:'Stima crescita', posts:'I tuoi post', content:'Content ideas', comment:'Genera commento', setup:'Impostazioni' };
  document.getElementById('pageTitle').textContent = titles[screen] || screen;

  showScreen(screen);
  if (screen === 'growth') calcGrowth();
  if (screen === 'posts') renderPosts();
  if (screen === 'content') renderSuggestions();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function initChips() {
  document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => c.classList.toggle('on')));
}
function getChips(id) { return [...document.querySelectorAll(`#${id} .chip.on`)].map(c => c.dataset.val); }

document.getElementById('btnSetupSave').addEventListener('click', () => {
  const apiKey = document.getElementById('setupApiKey').value.trim();
  const role   = document.getElementById('setupRole').value.trim();
  const followers = parseInt(document.getElementById('setupFollowers').value) || 0;
  const totalPosts = parseInt(document.getElementById('setupTotalPosts').value) || 0;

  if (!apiKey || apiKey.length < 20) { alert('Inserisci la API key.'); return; }
  if (!role) { alert('Inserisci il tuo ruolo.'); return; }

  const profile = {
    role,
    followers,
    totalPosts,
    goals: getChips('setupGoals'),
    tones: getChips('setupTones'),
    example: document.getElementById('setupExample').value.trim(),
    createdAt: Date.now(),
  };

  S.set('apiKey', apiKey);
  S.set('profile', profile);
  state.apiKey  = apiKey;
  state.profile = profile;

  if (profile.example) {
    const mem = S.get('memory') || [];
    if (!mem.find(m => m.text === profile.example)) {
      mem.unshift({ text: profile.example, ts: Date.now() });
      S.set('memory', mem.slice(0, 30));
      state.memory = S.get('memory');
    }
  }

  navTo('dashboard', document.querySelector('[data-screen="dashboard"]'));
  renderAll();
});

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  renderMetrics();
  renderScore();
  updateSyncStatus();
}

function renderSidebar() {
  const p = state.profile;
  if (!p) return;
  const initials = p.role.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
  document.getElementById('sidebarAvatar').textContent = initials;
  document.getElementById('sidebarName').textContent = p.role.split(',')[0];
  document.getElementById('sidebarLevel').textContent = getLevel(state.memory.length).name;
}

function updateSyncStatus() {
  const lastSync = S.get('lastSync');
  const el = document.getElementById('syncStatus');
  if (!lastSync) { el.textContent = 'nessuna sync'; el.className = 'sync-status'; return; }
  const mins = Math.floor((Date.now() - lastSync) / 60000);
  el.textContent = mins < 1 ? 'sync adesso' : mins < 60 ? `sync ${mins}m fa` : `sync ${Math.floor(mins/60)}h fa`;
  el.className = 'sync-status synced';
}

// ── Metrics ───────────────────────────────────────────────────────────────────
function renderMetrics() {
  const p = state.profile;
  const posts = state.posts;
  const memory = state.memory;

  // Follower
  document.getElementById('metFollowers').textContent = p?.followers ? p.followers.toLocaleString('it') : '—';

  // Post
  document.getElementById('metPosts').textContent = posts.length;

  // Engagement medio
  if (posts.length > 0) {
    const avgEng = Math.round(posts.reduce((s, p) => s + p.likes + p.comments, 0) / posts.length);
    document.getElementById('metEngagement').textContent = avgEng;
    document.getElementById('metEngChange').textContent = `su ${posts.length} post analizzati`;
  } else {
    document.getElementById('metEngagement').textContent = '—';
  }

  // Memory
  document.getElementById('metMemory').textContent = memory.length;
  document.getElementById('metMemoryLevel').textContent = getLevel(memory.length).name.toLowerCase();
}

// ── Score & Gap Analysis ──────────────────────────────────────────────────────
function renderScore() {
  const posts = state.posts;
  const p = state.profile;
  if (posts.length === 0 || !p) {
    document.getElementById('scoreDesc').textContent = 'Sincronizza i post per calcolare il tuo score';
    return;
  }

  // Score calculation (0-100)
  // Fattori: frequenza post, engagement rate, varietà contenuto, commenti generati
  const totalPosts = p.totalPosts || posts.length;
  const avgEng = posts.reduce((s, pp) => s + pp.likes + pp.comments, 0) / posts.length;
  const followers = p.followers || 1;
  const engRate = Math.min((avgEng / followers) * 100, 10); // cap 10%
  const typeVariety = new Set(posts.map(pp => pp.type)).size;
  const memoryCount = state.memory.length;

  const scores = {
    frequenza: Math.min(Math.round((totalPosts / 52) * 10 * 3.5), 35),   // 35pts max — post/anno
    engagement: Math.min(Math.round(engRate * 15), 30),                   // 30pts max — eng rate
    varieta: Math.min(typeVariety * 7, 20),                               // 20pts max — mix contenuti
    interazione: Math.min(Math.round(memoryCount * 0.5), 15),             // 15pts max — commenti
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const score = Math.min(total, 100);

  // Animate circle
  const circumference = 389.6;
  const offset = circumference - (score / 100) * circumference;
  document.getElementById('scoreCircle').style.strokeDashoffset = offset;
  document.getElementById('scoreCircle').style.transition = 'stroke-dashoffset 1s ease';
  document.getElementById('scoreNum').textContent = score;

  // Tier
  const tier = score >= 80 ? { name: 'AUTHORITY', desc: 'Profilo ad alta autorità — mantieni il ritmo' }
             : score >= 60 ? { name: 'CRESCITA ATTIVA', desc: 'Buona traiettoria — qualche gap da colmare' }
             : score >= 40 ? { name: 'IN SVILUPPO', desc: 'Potenziale buono — serve più costanza' }
             :               { name: 'AGLI INIZI', desc: 'Ottimo momento per costruire le basi' };

  document.getElementById('scoreTier').textContent = tier.name;
  document.getElementById('scoreDesc').textContent = tier.desc;

  // Gap analysis
  const gaps = [
    {
      name: 'Frequenza di pubblicazione',
      value: Math.round((scores.frequenza / 35) * 100),
      hint: scores.frequenza < 20 ? 'Punta a 3-5 post/settimana per accelerare la crescita' : 'Ottima frequenza',
    },
    {
      name: 'Tasso di engagement',
      value: Math.round((scores.engagement / 30) * 100),
      hint: scores.engagement < 15 ? 'L\'engagement migliora con post narrativi e domande' : 'Engagement sopra la media',
    },
    {
      name: 'Varietà formati',
      value: Math.round((scores.varieta / 20) * 100),
      hint: typeVariety < 3 ? 'Mescola testi, immagini e contenuti link' : 'Buona varietà di formati',
    },
    {
      name: 'Attività sui commenti',
      value: Math.round((scores.interazione / 15) * 100),
      hint: memoryCount < 10 ? 'I commenti strategici aumentano la visibilità del profilo' : 'Buona attività di engagement',
    },
  ];

  const gapEl = document.getElementById('gapItems');
  gapEl.innerHTML = gaps.map(g => {
    const color = g.value >= 70 ? 'green' : g.value >= 40 ? 'yellow' : 'red';
    return `
      <div class="gap-item">
        <div class="gap-item-top">
          <span class="gap-name">${g.name}</span>
          <span class="gap-score">${g.value}/100</span>
        </div>
        <div class="gap-bar"><div class="gap-fill ${color}" style="width:${g.value}%"></div></div>
        <div class="gap-hint">${g.hint}</div>
      </div>`;
  }).join('');
}

// ── Growth Calculator ─────────────────────────────────────────────────────────
function calcContentQuality() {
  // Calcola qualità contenuto automaticamente dai post sincronizzati (1-10)
  const posts = state.posts;
  const followers = state.profile?.followers || 1;
  if (posts.length === 0) return 5; // default se nessun dato

  const avgEng = posts.reduce((s, p) => s + p.likes + p.comments, 0) / posts.length;
  const engRate = (avgEng / followers) * 100;
  const typeVariety = new Set(posts.map(p => p.type)).size;
  const avgLen = posts.reduce((s, p) => s + p.text.length, 0) / posts.length;

  // Formula qualità: engagement rate + varietà + lunghezza media
  let q = 3; // base
  if (engRate > 5) q += 3;
  else if (engRate > 2) q += 2;
  else if (engRate > 0.5) q += 1;
  if (typeVariety >= 3) q += 2;
  else if (typeVariety >= 2) q += 1;
  if (avgLen > 500) q += 1;
  else if (avgLen > 200) q += 0.5;

  return Math.min(Math.round(q), 10);
}

function calcGrowth() {
  const postsPerWeek   = parseFloat(document.getElementById('growthPosts').value) || 3;
  const commentsPerDay = parseFloat(document.getElementById('growthComments').value) || 5;
  const months         = parseInt(document.getElementById('growthMonths').value) || 6;

  // Auto-fill follower dal profilo sincronizzato
  const profileFollowers = state.profile?.followers || 0;
  const syncedFollowers  = S.get('syncedFollowers') || 0;
  const followers = syncedFollowers || profileFollowers || parseFloat(document.getElementById('growthFollowers').value) || 500;

  // Aggiorna il campo solo se vuoto o zero
  const followersInput = document.getElementById('growthFollowers');
  if (followers > 0 && (!followersInput.value || followersInput.value === '0')) {
    followersInput.value = followers;
  }

  // Qualità calcolata automaticamente dai post
  const quality = calcContentQuality();
  const qualitySlider = document.getElementById('growthQuality');
  qualitySlider.value = quality;
  document.getElementById('qualityVal').textContent = quality;

  // Mostra label qualità auto-calcolata
  const qualityLabel = document.getElementById('qualityAutoLabel');
  if (qualityLabel) {
    const posts = state.posts;
    qualityLabel.textContent = posts.length > 0
      ? `calcolata automaticamente su ${posts.length} post sincronizzati`
      : 'sincronizza i post per il calcolo automatico';
  }

  const qualityMultiplier = 0.5 + (quality / 10) * 1.5;
  const baseFollowersPerPost = followers < 500 ? 2 : followers < 2000 ? 4 : followers < 10000 ? 8 : 12;
  const commentBoost = 1 + (commentsPerDay * 0.015);
  const weeklyGrowthRate = (postsPerWeek * baseFollowersPerPost * qualityMultiplier * commentBoost) / followers;

  const projections = [];
  let current = followers;
  for (let m = 1; m <= months; m++) {
    const weeksInMonth = 4.33;
    const monthlyNew = current * weeklyGrowthRate * weeksInMonth;
    current += monthlyNew;
    projections.push({ month: m, followers: Math.round(current), new: Math.round(monthlyNew) });
  }

  const finalFollowers = projections[projections.length - 1]?.followers || followers;
  const maxProjected = finalFollowers;

  const el = document.getElementById('projectionResult');
  el.innerHTML = `
    <div class="proj-total">
      <div class="proj-total-num">+${(finalFollowers - followers).toLocaleString('it')}</div>
      <div class="proj-total-label">follower stimati in ${months} mesi → totale ~${finalFollowers.toLocaleString('it')}</div>
    </div>
    ${projections.map(p => `
      <div class="proj-milestone">
        <span class="proj-month">MESE ${p.month}</span>
        <div class="proj-bar-wrap">
          <div class="proj-bar-fill" style="width:${Math.round((p.followers / maxProjected) * 100)}%"></div>
        </div>
        <span class="proj-num">${p.followers.toLocaleString('it')}</span>
        <span class="proj-note">+${p.new.toLocaleString('it')}</span>
      </div>`).join('')}
  `;

  document.getElementById('growthAssumptions').innerHTML = `
    → ${postsPerWeek} post/settimana × qualità ${quality}/10 (auto) × ${commentsPerDay} commenti/giorno<br>
    → Follower attuali: ${followers.toLocaleString('it')} ${syncedFollowers ? '(da sync LinkedIn)' : '(da profilo)'}<br>
    → Reach stimata per post: ~${Math.round(followers * 0.08 * qualityMultiplier)} persone<br>
    → Conversione follower: ~${(weeklyGrowthRate * 100).toFixed(2)}%/settimana<br>
    → Boost commenti: +${((commentBoost - 1) * 100).toFixed(0)}% visibilità<br>
    <span style="color:var(--muted);font-size:11px;margin-top:8px;display:block">
      Modello basato su benchmark LinkedIn B2B Italia. La qualità contenuto è calcolata automaticamente da engagement rate, varietà formati e lunghezza media dei post.
    </span>
  `;
}

// ── Posts table ───────────────────────────────────────────────────────────────
function renderPosts() {
  const posts = state.posts;
  const el = document.getElementById('postsBody');

  if (posts.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-title">Nessun post sincronizzato</div><div class="empty-sub">Vai sul tuo profilo LinkedIn con l'estensione Comgy attiva e clicca "Sincronizza i tuoi post".</div></div>`;
    return;
  }

  const followers = state.profile?.followers || 1;
  el.innerHTML = posts.map(p => {
    const eng = p.likes + p.comments;
    const engRate = ((eng / followers) * 100).toFixed(1);
    const typeClass = p.type === 'image' ? 'type-image' : p.type === 'video' ? 'type-video' : 'type-text';
    const preview = p.text.length > 60 ? p.text.slice(0, 60) + '…' : p.text;
    const score = Math.min(Math.round((eng / followers) * 1000), 100);
    return `
      <div class="table-row">
        <div class="td text" title="${p.text}">${preview}</div>
        <div class="td"><span class="type-badge ${typeClass}">${p.type.toUpperCase()}</span></div>
        <div class="td accent">${p.likes}</div>
        <div class="td">${p.comments}</div>
        <div class="td ${score > 50 ? 'accent' : score > 20 ? 'warn' : ''}">${score}</div>
      </div>`;
  }).join('');
}

// ── Content suggestions ───────────────────────────────────────────────────────
async function renderSuggestions() {
  const posts = state.posts;
  const profile = state.profile;
  const el = document.getElementById('suggestionsGrid');

  if (posts.length < 3) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">✦</div><div class="empty-title">Dati insufficienti</div><div class="empty-sub">Sincronizza almeno 3 post per ricevere suggerimenti personalizzati.</div></div>`;
    return;
  }

  // Check cache
  const cached = S.get('suggestionCache');
  const cacheAge = S.get('suggestionCacheAge');
  if (cached && cacheAge && (Date.now() - cacheAge) < 3600000) {
    renderSuggestionCards(cached);
    return;
  }

  el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-family:'Space Mono',monospace;font-size:11px">✦ Analisi AI in corso...</div>`;

  const postSummary = posts.slice(0, 10).map((p, i) =>
    `${i+1}. [${p.type}] Like:${p.likes} Commenti:${p.comments} — "${p.text.slice(0,100)}"`
  ).join('\n');

  const prompt = `Sei un marketing manager LinkedIn senior specializzato in crescita organica B2B.

Analizza questi post pubblicati da: ${profile.role}
Obiettivi: ${profile.goals?.join(', ')}

POST PUBBLICATI (con engagement):
${postSummary}

Sulla base di questi dati reali, genera 6 suggerimenti strategici su COSA POSTARE.
Non scrivere il post — indica il tipo/formato e l'argomento specifico.

Per ogni suggerimento indica:
- type: categoria (divulgazione, storytelling, insight, tutorial, opinione, dati)
- title: titolo del suggerimento (max 8 parole)
- desc: spiegazione concisa del perché funzionerà per questo profilo (max 25 parole)
- impact: stima impatto (Alto/Medio/Basso engagement)
- freq: frequenza consigliata (es. 1x/settimana)

Rispondi SOLO con JSON:
{"suggestions":[{"type":"...","title":"...","desc":"...","impact":"...","freq":"..."}]}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role:'user', content: prompt }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const raw = (data.content||[]).map(b => b.text||'').join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    S.set('suggestionCache', parsed.suggestions);
    S.set('suggestionCacheAge', Date.now());
    renderSuggestionCards(parsed.suggestions);
  } catch(e) {
    el.innerHTML = `<div style="grid-column:1/-1;color:var(--danger);font-size:12px;padding:20px;font-family:monospace">Errore analisi: ${e.message}</div>`;
  }
}

function renderSuggestionCards(suggestions) {
  const el = document.getElementById('suggestionsGrid');
  el.innerHTML = suggestions.map(s => `
    <div class="suggestion-card">
      <div class="sugg-type">${s.type}</div>
      <div class="sugg-title">${s.title}</div>
      <div class="sugg-desc">${s.desc}</div>
      <div class="sugg-meta">
        <span class="sugg-impact">↑ ${s.impact}</span>
        <span class="sugg-freq">${s.freq}</span>
      </div>
    </div>`).join('');
}

// ── Comment generator ─────────────────────────────────────────────────────────
document.getElementById('btnCommentGenerate').addEventListener('click', async () => {
  const post = document.getElementById('commentPost').value.trim();
  if (!post) { alert('Incolla un post prima.'); return; }

  const btn = document.getElementById('btnCommentGenerate');
  const spinner = document.getElementById('commentSpinner');
  const results = document.getElementById('commentResults');

  btn.disabled = true;
  btn.textContent = 'GENERANDO...';
  spinner.classList.add('on');
  results.innerHTML = '';

  const tone   = document.getElementById('commentTone').value;
  const length = document.getElementById('commentLength').value;
  const p = state.profile;
  const mem = state.memory;

  const lengthMap = { short:'max 25 parole', medium:'max 55 parole', long:'max 90 parole' };
  const toneMap = {
    mix:      'Genera type="professional" + type="question" + type="insight"',
    expert:   'Genera 3 varianti type="professional" con angoli diversi',
    question: 'Genera 3 varianti type="question" con domande diverse',
    insight:  'Genera 3 varianti type="insight" con prospettive diverse',
  };

  const memSection = mem.length >= 5
    ? `\n[STILE APPRESO — ${mem.length} esempi]\n${mem.slice(0,8).map((m,i) => `${i+1}. "${m.text}"`).join('\n')}\n`
    : p?.example ? `\n[SEED STILE]\n"${p.example}"\n` : '';

  const prompt = `Sei ${p?.role || 'un professionista LinkedIn'}.
Tono: ${p?.tones?.join(', ') || 'naturale'}.
${memSection}

Post da commentare:
---
${post}
---

ANALISI: Leggi attentamente il post. Rispondi al contenuto specifico, non al tuo settore.
${toneMap[tone]}

Regole: ${lengthMap[length]} per commento, italiano naturale, zero emoji, zero hashtag.
JSON only: {"comments":[{"type":"professional","text":"..."},{"type":"question","text":"..."},{"type":"insight","text":"..."}]}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':state.apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1000, messages:[{ role:'user', content:prompt }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const raw = (data.content||[]).map(b => b.text||'').join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());

    spinner.classList.remove('on');
    renderCommentCards(parsed.comments);
  } catch(e) {
    spinner.classList.remove('on');
    results.innerHTML = `<div style="color:var(--danger);font-size:12px;padding:16px;font-family:monospace">ERR: ${e.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = 'GENERA COMMENTI';
});

function renderCommentCards(comments) {
  const el = document.getElementById('commentResults');
  const meta = {
    professional: { l:'PROFESSIONALE', c:'tag-pro' },
    question:     { l:'DOMANDA', c:'tag-q' },
    insight:      { l:'INSIGHT', c:'tag-ins' },
  };
  el.innerHTML = '';
  comments.forEach(c => {
    const m = meta[c.type] || { l:c.type.toUpperCase(), c:'tag-pro' };
    const card = document.createElement('div');
    card.className = 'res-card';
    card.dataset.text = c.text;
    card.innerHTML = `
      <div class="res-top">
        <span class="tag ${m.c}">${m.l}</span>
        <button class="copy-pill">COPIA</button>
      </div>
      <div class="res-text">${c.text}</div>`;
    el.appendChild(card);
  });
}

document.getElementById('commentResults').addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-pill');
  if (!btn) return;
  const text = btn.closest('.res-card').dataset.text;
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  const mem = S.get('memory') || [];
  if (!mem.find(m => m.text === text)) {
    mem.unshift({ text, ts: Date.now() });
    S.set('memory', mem.slice(0,30));
    state.memory = mem;
    renderMetrics();
    renderSidebar();
  }
  btn.textContent = '✓';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = 'COPIA'; btn.classList.remove('copied'); }, 1600);
});

// ── Listen for extension sync ─────────────────────────────────────────────────
// La dashboard controlla localStorage ogni 5 secondi per nuovi post dall'estensione
setInterval(() => {
  const newPosts = S.get('syncedPosts') || [];
  if (newPosts.length !== state.posts.length) {
    state.posts = newPosts;
    renderMetrics();
    renderScore();
    updateSyncStatus();
    S.del('suggestionCache'); // invalida cache suggerimenti
  }
}, 5000);

// ── Boot ──────────────────────────────────────────────────────────────────────

// Controlla se ci sono dati sync nell'URL (passati dall'estensione)
function checkUrlSync() {
  const params = new URLSearchParams(window.location.search);
  const syncParam = params.get('sync');
  if (!syncParam) return;

  try {
    const data = JSON.parse(decodeURIComponent(syncParam));
    if (data.posts?.length) {
      const existing = S.get('syncedPosts') || [];
      const merged = mergePosts(existing, data.posts);
      S.set('syncedPosts', merged);
      S.set('lastSync', data.lastSync || Date.now());
      state.posts = merged;
    }
  } catch(e) {}

  // Pulisce l'URL senza ricaricare la pagina
  window.history.replaceState({}, '', window.location.pathname);
}

function mergePosts(existing, newPosts) {
  const merged = [...existing];
  newPosts.forEach(p => {
    if (!merged.find(e => e.text === p.text || (e.url && e.url === p.url && e.url !== window.location.href))) {
      merged.push(p);
    }
  });
  return merged.slice(0, 100);
}

init();
checkUrlSync();
