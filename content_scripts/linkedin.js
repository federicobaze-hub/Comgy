// ── Comgy — linkedin.js v3 ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === 'sync_profile') {
    const posts = [];
    const seen = new Set();

    // Approccio 1: selettori classici
    const selectors = [
      'div.feed-shared-update-v2',
      'div[data-urn*="activity"]',
      'div[data-id*="activity"]',
      'li.profile-creator-shared-feed-update__container',
      'div.profile-creator-shared-feed-update',
      'div[class*="occludable-update"]',
      'article',
    ];

    let cards = [];
    for (const sel of selectors) {
      const found = [...document.querySelectorAll(sel)];
      if (found.length > 0) { cards = found; break; }
    }

    // Approccio 2: cerca tutti i div con testo lungo e pulsante like
    if (cards.length === 0) {
      cards = [...document.querySelectorAll('div')].filter(el => {
        const txt = (el.innerText || '').trim();
        if (txt.length < 100 || txt.length > 5000) return false;
        const hasLike = el.querySelector('button[aria-label*="eaction"], button[aria-label*="Like"], button[aria-label*="like"], span[data-reaction]');
        return !!hasLike;
      });
    }

    // Approccio 3: fallback totale — prende tutti i blocchi di testo con span[dir=ltr]
    if (cards.length === 0) {
      const spans = [...document.querySelectorAll('span[dir="ltr"]')]
        .filter(s => s.innerText?.trim().length > 80);
      spans.forEach(span => {
        const txt = span.innerText.trim();
        if (!seen.has(txt)) {
          seen.add(txt);
          posts.push({ text: txt, date: '', likes: 0, comments: 0, impressions: 0, type: 'text', url: window.location.href });
        }
      });
    }

    cards.forEach(card => {
      try {
        const textEl = card.querySelector(
          '.feed-shared-update-v2__description, ' +
          '.feed-shared-text, ' +
          '.update-components-text, ' +
          '[class*="commentary"], ' +
          'span[dir="ltr"]'
        );
        const text = (textEl?.innerText || card.innerText || '').trim().slice(0, 2000);
        if (!text || text.length < 50 || seen.has(text)) return;
        seen.add(text);

        const likesEl = card.querySelector('[aria-label*="reaction"], .social-details-social-counts__reactions-count, [class*="reaction-count"]');
        const likes = parseInt((likesEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0;

        const commentsEl = card.querySelector('[aria-label*="comment"], .social-details-social-counts__comments, [class*="comment-count"]');
        const comments = parseInt((commentsEl?.innerText || '0').replace(/[^0-9]/g,'')) || 0;

        let type = 'text';
        if (card.querySelector('video')) type = 'video';
        else if (card.querySelector('img[class*="ivm"], [class*="image"]')) type = 'image';
        else if (card.querySelector('[class*="article"], [class*="external"]')) type = 'link';

        const linkEl = card.querySelector('a[href*="activity"], a[href*="ugcPost"]');
        const url = linkEl?.href?.split('?')[0] || window.location.href;

        posts.push({ text, date: '', likes, comments, impressions: 0, type, url });
      } catch(e) {}
    });

    sendResponse({ posts });
    return true;
  }

  if (msg.action === 'get_post_text') {
    let text = '';
    const selectors = [
      '.feed-shared-update-v2__description .break-words',
      '.feed-shared-text .break-words',
      '.update-components-text .break-words',
      '[class*="commentary"] span[dir="ltr"]',
      'span[dir="ltr"]',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length) {
        text = [...els].map(e => e.innerText.trim()).join('\n').trim();
        if (text.length > 20) break;
      }
    }
    sendResponse({ text });
    return true;
  }

  if (msg.action === 'get_profile_info') {
    let followers = 0;
    document.querySelectorAll('span, button, a').forEach(el => {
      const t = (el.innerText || '').toLowerCase().trim();
      if ((t.includes('follower') || t.includes('seguac')) && t.length < 40) {
        const num = parseInt(t.replace(/[^0-9]/g,''));
        if (num > 0) followers = Math.max(followers, num);
      }
    });
    const nameEl = document.querySelector('h1');
    sendResponse({ name: nameEl?.innerText?.trim() || '', followers, url: window.location.href.split('?')[0] });
    return true;
  }
});
