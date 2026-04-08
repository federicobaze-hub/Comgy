// ── Comgy — linkedin.js ──────────────────────────────────────────────────────
// Legge i tuoi post dal tuo profilo + engagement visibile
// Legge post dal feed per generare commenti

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── Sync profilo: legge i tuoi post con engagement ────────────────────────
  if (msg.action === 'sync_profile') {
    const posts = [];

    // Selettori per profilo + recent-activity
    const cardSelectors = [
      'div.feed-shared-update-v2',
      'div[data-urn*="activity"]',
      'li.profile-creator-shared-feed-update__container',
      'div.profile-creator-shared-feed-update',
      'div[class*="occludable-update"]',
      'div[data-id*="activity"]',
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      cards = [...document.querySelectorAll(sel)];
      if (cards.length > 0) break;
    }

    // Fallback aggressivo per recent-activity
    if (cards.length === 0) {
      const allDivs = [...document.querySelectorAll('div')];
      cards = allDivs.filter(el => {
        const txt = el.innerText || '';
        const hasText = txt.length > 80 && txt.length < 3000;
        const hasLike = el.querySelector('button[aria-label*="reaction"], span[aria-label*="reaction"], .social-details-social-counts__reactions-count');
        return hasText && hasLike;
      }).slice(0, 20);
    }

    cards.forEach(card => {
      try {
        // Testo del post
        const textEl = card.querySelector(
          '.feed-shared-update-v2__description .break-words, ' +
          '.feed-shared-text .break-words, ' +
          '.update-components-text .break-words, ' +
          'span[dir="ltr"]'
        );
        const text = textEl?.innerText?.trim() || '';
        if (!text || text.length < 20) return;

        // Data
        const dateEl = card.querySelector('time, .feed-shared-actor__sub-description span[aria-hidden="true"]');
        const date = dateEl?.innerText?.trim() || dateEl?.getAttribute('datetime') || '';

        // Like / reactions
        const likesEl = card.querySelector(
          '.social-details-social-counts__reactions-count, ' +
          'button[aria-label*="reaction"] span, ' +
          '.social-details-social-counts__count-value'
        );
        const likes = parseInt(likesEl?.innerText?.replace(/[^0-9]/g, '') || '0') || 0;

        // Commenti
        const commentsEl = card.querySelector(
          'button[aria-label*="comment"] span, ' +
          '.social-details-social-counts__comments span'
        );
        const comments = parseInt(commentsEl?.innerText?.replace(/[^0-9]/g, '') || '0') || 0;

        // Impression / visualizzazioni (solo creator, non sempre visibili)
        const impressionEl = card.querySelector(
          '.feed-shared-social-action-bar__view-count, ' +
          'button[aria-label*="impression"], ' +
          'span[aria-label*="impression"]'
        );
        const impressions = parseInt(impressionEl?.innerText?.replace(/[^0-9]/g, '') || '0') || 0;

        // Tipo contenuto (testo, immagine, video, link)
        let type = 'text';
        if (card.querySelector('video, .feed-shared-linkedin-video')) type = 'video';
        else if (card.querySelector('img.ivm-view-attr__img--centered, .feed-shared-image')) type = 'image';
        else if (card.querySelector('.feed-shared-article, .feed-shared-external-video')) type = 'link';

        // URL post
        const linkEl = card.querySelector('a[href*="activity"]');
        const url = linkEl?.href?.split('?')[0] || '';

        posts.push({ text, date, likes, comments, impressions, type, url });

      } catch (e) { /* skip */ }
    });

    sendResponse({ posts });
    return true;
  }

  // ── Leggi post dal feed per generare commento ─────────────────────────────
  if (msg.action === 'get_post_text') {
    let text = '';
    const selectors = [
      '.feed-shared-update-v2__description .break-words',
      '.feed-shared-text .break-words',
      '.update-components-text .break-words',
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

  // ── Leggi info base profilo ───────────────────────────────────────────────
  if (msg.action === 'get_profile_info') {
    const nameEl = document.querySelector('h1.text-heading-xlarge, h1');
    const followerEl = document.querySelector(
      'span[aria-label*="follower"], ' +
      '.artdeco-tabpanel span:contains("follower"), ' +
      '.profile-creator-shared-feed-update__header span'
    );

    // Cerca follower in modo più aggressivo
    let followers = 0;
    document.querySelectorAll('span, button').forEach(el => {
      const t = el.innerText?.toLowerCase() || '';
      if (t.includes('follower') && t.length < 30) {
        const num = parseInt(t.replace(/[^0-9]/g, ''));
        if (num > 0) followers = num;
      }
    });

    sendResponse({
      name: nameEl?.innerText?.trim() || '',
      followers,
      url: window.location.href.split('?')[0],
    });
    return true;
  }

});
