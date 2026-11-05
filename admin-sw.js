const CACHE = 'painel-admin-v1';
const FILES = [
  '/pool-piscina-pro/admin.html',
  '/pool-piscina-pro/manifest-admin.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
