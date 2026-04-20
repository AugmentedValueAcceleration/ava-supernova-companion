const CACHE_VERSION = '0.1.2';
const CACHE_NAME = `ava-companion-v${CACHE_VERSION}`;
const STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Message handler — page can request version or force update
self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Skip non-http(s) schemes — chrome-extension://, data:, etc. can't be cached
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API responses must never be cached. iOS Safari is aggressive about
  // failing backgrounded/suspended fetches; if we cache API responses and
  // fall back to cache on failure, we silently serve stale `{memories:[]}`
  // (or any other list) to signed-in users whose first visit cached an
  // empty/unauthenticated response. Data endpoints must always be live.
  const isApi = url.pathname.startsWith('/api/') || /^\/api\//.test(url.pathname);
  if (isApi) {
    return; // Let the browser handle it directly — no SW interception
  }

  // Static assets: network-first with cache fallback for offline support.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
