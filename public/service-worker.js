// Archivo básico de service worker para cachear archivos esenciales
const CACHE_NAME = 'makeroute-cache-v1';
const urlsToCache = [
  '/',
  '/makeroute/index.html',
  '/makeroute/manifest.json',
  '/makeroute/src/main.js',
  '/makeroute/src/style.css',
  // Agrega aquí más archivos según tu estructura
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).catch(() => {
        // Si es una navegación (HTML), hacer fallback a index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/makeroute/index.html');
        }
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
});
