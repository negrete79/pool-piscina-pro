/* ============================================================
   PoolApp Universal · Service Worker v10
   - Shell offline: index.html em cache, atualiza network-first
   - NUNCA cacheia /api/* (pagamento/licença precisa de rede real)
   - Ícones e demais assets: cache-first com atualização em background
   ============================================================ */
const CACHE = 'poolapp-v10';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) API de pagamento/licença: SEMPRE rede, jamais cache
  if (url.pathname.includes('/api/')) return;

  // 2) Navegação: network-first, cai para o cache offline
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', cp));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3) Demais assets (ícones, fontes): cache-first
  e.respondWith(
    caches.match(req).then(hit => hit ||
      fetch(req).then(r => {
        if (r.ok && (url.origin === location.origin || url.hostname.includes('fonts'))) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return r;
      })
    )
  );
});
