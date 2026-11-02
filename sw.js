// Arc & Iron service worker: network-first for the app page so updates arrive on next open,
// cache fallback so it still works offline.
const CACHE='arc-iron-v3';
const CORE=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','keepawake.js','demos.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  const isPage=req.mode==='navigate'||url.pathname.endsWith('/index.html');
  const isFont=/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if(url.origin!==location.origin&&!isFont)return;
  if(isPage){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('index.html',cp));return r}).catch(()=>caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>{
    const net=fetch(req).then(r=>{if(r.ok||r.type==='opaque'){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r}).catch(()=>hit);
    return hit||net;
  }));
});
