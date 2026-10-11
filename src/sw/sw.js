// SecurePass service worker (KTD11). Keeps every page, script, style, font and wordlist on the
// device so the tool works with no connection after the first visit. It only ever touches GET
// requests to this site: requests to anywhere else, including the opt-in breach check, pass straight
// through and are never cached. The build fills in the version and the precache list.

const VERSION = "__SP_VERSION__";
const PRECACHE = __SP_PRECACHE__;
const CACHE = `securepass-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("securepass-") && name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// A new version waits until the page asks for it, so an open tab never mixes old and new files.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, url));
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

// Pages: the network when online, so a deploy shows up on the next load; the cached copy offline.
async function networkFirst(request, url) {
  try {
    return await fetch(request);
  } catch (error) {
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    const cached = await caches.match(path, { cacheName: CACHE });
    if (cached) return cached;
    throw error;
  }
}

// Hashed assets and icons never change under the same URL, so the cache answers first.
async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: CACHE });
  return cached ?? fetch(request);
}
