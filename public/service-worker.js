// Service worker para abrir la app y reutilizar recursos cuando la señal es debil o nula.
const CACHE_NAME = 'makeroute-cache-v3';

function getAppShellUrls() {
  const scopeUrl = new URL('./', self.registration.scope);

  return [
    scopeUrl.href,
    new URL('index.html', scopeUrl).href,
    new URL('manifest.json', scopeUrl).href,
  ];
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(getAppShellUrls());
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (!isSameOrigin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(new URL('index.html', new URL('./', self.registration.scope)).href)
          || cache.match(new URL('./', self.registration.scope).href);
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);

        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (_error) {
        return caches.match(new URL('index.html', new URL('./', self.registration.scope)).href);
      }
    }),
  );
});
