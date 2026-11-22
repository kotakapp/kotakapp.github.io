const C='kotak-v5',F=['index.html','styles.css','app.js','config.js','icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)));
});
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(_){}
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    if(list.some(c=>c.focused))return;
    return self.registration.showNotification(d.title||'KotakApp',{body:d.body||'Новое сообщение',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||'kotak'});
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list.length?list[0].focus():self.clients.openWindow('./')));
});
