const CACHE_NAME = 'cyclodash-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Installation et mise en cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Récupération des ressources hors-ligne
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});