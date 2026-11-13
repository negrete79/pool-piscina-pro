/* ================= NEGRET'S v3.7 — Service Worker (PWA offline) ================= */
const VER = 'negrets-v3.7.0';
const CORE = [
  './',
  './track.html',
  './admin.html',
  './manifest.json',
  './icone.svg',
  './icon-192.png',
  './icon-512.png',
  './maskable-192.png',
  './maskable-512.png',
  './offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* rastreio na nuvem (ntfy) — SEMPRE rede, nunca cachear */
  if (url.hostname === 'ntfy.sh') return;

  /* navegação (index/track): rede primeiro, cache se offline */
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const cp = res.clone();
          caches.open(VER).then(c => c.put(req, cp)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match('./offline.html'))
        )
    );
    return;
  }

  /* estáticos e CDNs (fontes, libs): stale-while-revalidate */
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const cp = res.clone();
            caches.open(VER).then(c => c.put(req, cp)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
