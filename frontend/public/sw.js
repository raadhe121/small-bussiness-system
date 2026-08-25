/* BusinessHub service worker — offline app shell + product cache + offline fallback */
const VERSION = "v1";
const STATIC_CACHE = `bh-static-${VERSION}`;
const PAGE_CACHE = `bh-pages-${VERSION}`;
const API_CACHE = `bh-api-${VERSION}`;

const PRECACHE = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/* API GETs cached for offline viewing (network-first with cache fallback).
   Every read endpoint is cached except volatile/private ones. */
const OFFLINE_API_SKIP = [
  /\/api\/auth\//,
  /\/api\/search/,
  /\/api\/notifications/,
];
function isCacheableApi(url) {
  if (!url.pathname.startsWith("/api/")) return false;
  return !OFFLINE_API_SKIP.some((p) => p.test(url.pathname));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![STATIC_CACHE, PAGE_CACHE, API_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (fallback) return fallback();
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first, fall back to cached page, then offline.html
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, PAGE_CACHE, async () => {
        const offline = await caches.match("/offline.html");
        return offline || Response.error();
      })
    );
    return;
  }

  // Cached API reads for offline viewing of any section
  if (isCacheableApi(url)) {
    event.respondWith(
      networkFirst(request, API_CACHE, async () =>
        new Response(
          JSON.stringify({
            success: false,
            message: "Offline — showing last cached data",
            offline: true,
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      ).catch(() =>
        new Response(
          JSON.stringify({ success: false, message: "Offline and no cached data" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (url.pathname.startsWith("/assets/") || /\.(js|css|png|jpg|svg|woff2?|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
