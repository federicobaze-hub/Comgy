// ── Comgy — background.js (service worker) ───────────────────────────────────
// Bridge tra chrome.storage (estensione) e localStorage (dashboard Vercel)

const DASHBOARD_URL = 'https://comgy.vercel.app';

// Quando una tab della dashboard finisce di caricare, inietta i dati
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith(DASHBOARD_URL)) return;

  // Leggi tutti i dati dall'extension storage
  const data = await chrome.storage.local.get([
    'syncedPosts', 'lastSync', 'syncedFollowers', 'memory'
  ]);

  if (!data.syncedPosts?.length && !data.memory?.length) return;

  // Inietta i dati nel localStorage della dashboard
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (storageData) => {
        if (storageData.syncedPosts?.length) {
          localStorage.setItem('comgy_syncedPosts', JSON.stringify(storageData.syncedPosts));
          localStorage.setItem('comgy_lastSync', JSON.stringify(storageData.lastSync || Date.now()));
        }
        if (storageData.syncedFollowers > 0) {
          // Aggiorna i follower nel profilo salvato
          try {
            const profile = JSON.parse(localStorage.getItem('comgy_profile') || '{}');
            profile.followers = storageData.syncedFollowers;
            localStorage.setItem('comgy_profile', JSON.stringify(profile));
          } catch(e) {}
        }
        if (storageData.memory?.length) {
          localStorage.setItem('comgy_memory', JSON.stringify(storageData.memory));
        }
        // Segnala alla dashboard che i dati sono pronti
        window.dispatchEvent(new CustomEvent('comgy_sync', { detail: storageData }));
      },
      args: [data]
    });
  } catch(e) {}
});

// Quando popup copia un commento, salva in chrome.storage
// (già gestito in popup.js, ma qui sincronizziamo in background)
chrome.storage.onChanged.addListener((changes) => {
  // Niente da fare — il service worker è solo un bridge
});
