const CACHE = "truck-work-diary-v78-pwa-header-safe-remove-legacy-stats";
const ASSETS = ["./","index.html","styles.css","app.js","manifest.json","icon-192.png","icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE && /truck-work-diary|work-diary|diary/i.test(k)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener("message", e => {
  if(e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
