/* Service worker de Verdure : fonctionnement hors ligne et réception des rappels. */
const CACHE = "verdure-v2";
const SHELL = ["./", "index.html", "styles.css", "data.js", "app.js", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* Fichiers de l'appli : réponse immédiate depuis le cache, mise à jour en arrière-plan. */
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => cached);
    return cached || fresh;
  }));
});

self.addEventListener("push", e => {
  let msg = { title: "Verdure", body: "Vos plantes ont besoin de vous aujourd'hui." };
  try { msg = { ...msg, ...e.data.json() }; } catch { /* message texte simple */ }
  e.waitUntil(self.registration.showNotification(msg.title, { body: msg.body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "verdure-soins", data: { url: msg.url || "./" } }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow(e.notification.data?.url || "./");
  }));
});
