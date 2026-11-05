const CACHE='poolapp-v34';
const ASSETS=['/','/index.html','/manifest.json','/icon-192.png','/icon-512.png','/icon-180.png','/admin.html','/admin/forgot.html','/admin/reset.html'];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;                       // POST da API nunca passa daqui
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/')) return;         // API do pagamento: SEMPRE rede, nunca cache
  const aceitar=(req.headers&&req.headers.get('accept'))||'';
  const isNav=req.mode==='navigate'||aceitar.indexOf('text/html')!==-1;
  if(isNav){
    // navegação: rede primeiro (HTML sempre novo), cache só se ficar offline
    e.respondWith(
      fetch(req).then(r=>{
        if(r&&r.ok){try{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}catch(_){}}
        return r;
      }).catch(()=>caches.match(req).then(m=>m||caches.match('/index.html')))
    );
    return;
  }
  // estáticos: cache primeiro, atualiza por baixo
  e.respondWith(caches.match(req).then(hit=>{
    if(hit) return hit;
    return fetch(req).then(r=>{
      if(r&&r.ok&&url.origin===location.origin){try{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}catch(_){}}
      return r;
    }).catch(()=>hit);
  }));
});
