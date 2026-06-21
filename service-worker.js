const CACHE = "truck-work-diary-v67-nhvr-engine-qa-final";
const ASSETS = ["./","index.html","styles.css","app.js","manifest.json","icon-192.png","icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
