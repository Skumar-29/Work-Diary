const CACHE = "truck-work-diary-v87-stats-asof-speed-fix";
const ASSETS = ["index.html","styles.css","app.js","manifest.json","icon-192.png","icon-512.png"];

async function putIfSafe(cache, key, response){
  if(!response || !response.ok || response.redirected) return response;
  try{
    await cache.put(key, response.clone());
  }catch(e){}
  return response;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for(const asset of ASSETS){
      try{
        const response = await fetch(new Request(asset, {cache:"reload"}));
        await putIfSafe(cache, asset, response);
      }catch(e){}
    }
  })());
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k !== CACHE && /truck-work-diary|work-diary|diary/i.test(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if(event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if(event.data && event.data.type === "CLEAR_APP_CACHE"){
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => /truck-work-diary|work-diary|diary/i.test(k)).map(k => caches.delete(k)));
    })());
  }
  if(event.data && event.data.type === "CLEAR_OLD_APP_CACHES"){
    event.waitUntil((async () => {
      const keep = event.data.keep || CACHE;
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== keep && /truck-work-diary|work-diary|diary/i.test(k)).map(k => caches.delete(k)));
    })());
  }
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;

  // App launch / navigation: always use index.html, never a cached redirect.
  if(event.request.mode === "navigate"){
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try{
        const response = await fetch(new Request("index.html", {cache:"no-store"}));
        if(response && response.ok && !response.redirected){
          await putIfSafe(cache, "index.html", response.clone());
          return response;
        }
      }catch(e){}
      const cached = await cache.match("index.html");
      if(cached && !cached.redirected) return cached;
      return new Response("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Work Diary</title></head><body><h1>Work Diary</h1><p>App files are updating. Please close and reopen the app.</p></body></html>", {
        headers: {"Content-Type":"text/html; charset=utf-8"}
      });
    })());
    return;
  }

  if(!sameOrigin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if(cached && !cached.redirected) return cached;

    try{
      const response = await fetch(event.request);
      if(response && response.ok && !response.redirected){
        await putIfSafe(cache, event.request, response.clone());
      }
      if(response && response.redirected){
        const fallback = await cache.match(requestUrl.pathname.replace(/^\//,""));
        if(fallback && !fallback.redirected) return fallback;
      }
      return response;
    }catch(e){
      const fallback = await cache.match(requestUrl.pathname.replace(/^\//,""));
      if(fallback && !fallback.redirected) return fallback;
      throw e;
    }
  })());
});
