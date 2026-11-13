/* ============================================================
   PoolApp · Painel Admin — service worker SEPARADO do site
   Registrado com { scope: '/admin.html' } → controla SÓ o painel.
   O site principal continua com o sw.js dele (escopo /), os dois
   coexistem: o navegador usa sempre o escopo mais específico.
   Regras: cache só de /admin.html e /manifest-admin.json ·
   API /api/ NUNCA é cacheada · try/catch em tudo — se o cache
   falhar, o painel segue funcionando pela rede.
   ============================================================ */
const CACHE = 'poolapp-admin-v1';
const ARQS  = ['/admin.html', '/manifest-admin.json'];

self.addEventListener('install', e => {
  try{
    console.log('[admin-sw] instalando — cache ' + CACHE);
    self.skipWaiting();
    e.waitUntil(
      caches.open(CACHE)
        .then(c => c.addAll(ARQS))
        .then(() => console.log('[admin-sw] cache pronto: ' + ARQS.join(', ')))
        .catch(err => console.log('[admin-sw] cache falhou (painel segue pela rede): ' + err.message))
    );
  }catch(_){}
});

self.addEventListener('activate', e => {
  try{
    e.waitUntil((async () => {
      try{
        const ks = await caches.keys();
        await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
        console.log('[admin-sw] ativo — assumindo o controle de /admin.html');
      }catch(err){ console.log('[admin-sw] ativação com falha (sem efeito no painel): ' + err.message); }
    })());
  }catch(_){}
});

self.addEventListener('fetch', e => {
  try{
    const req = e.request;
    if(req.method !== 'GET') return;                    /* login/POST: sempre rede */
    const url = new URL(req.url);
    if(url.origin !== location.origin) return;          /* CDN (tailwind/fontes): fora */
    if(url.pathname.startsWith('/api/')) return;        /* API: SEMPRE rede, nunca cache */
    const aceitar = (req.headers && req.headers.get('accept')) || '';
    const isNav = req.mode === 'navigate' || aceitar.indexOf('text/html') !== -1;
    if(!isNav) return;                                  /* só cuida da navegação do painel */
    if(url.pathname !== '/admin.html' && url.pathname !== '/manifest-admin.json') return;
    e.respondWith((async () => {
      try{
        const r = await fetch(req);                     /* rede primeiro — HTML sempre novo */
        if(r && r.ok){
          try{ const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }catch(_){}
        }
        return r;
      }catch(_){
        try{
          const m = await caches.match(req);
          if(m) return m;                               /* offline: serve o cache */
        }catch(_){}
        return new Response('Painel offline — reconecte para usar.', {
          status: 503, statusText: 'offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
  }catch(_){}
});
