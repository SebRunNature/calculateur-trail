// Service Worker — Calculateur Temps de Passage Trail · Seb Run Nature
// Stratégie network-first : les mises à jour déployées apparaissent immédiatement,
// avec repli sur le cache hors ligne. Nettoyage automatique des anciennes versions.
const CACHE = 'srn-calculateur-trail-v15';
const FILES = [
  '/calculateur-trail/',
  '/calculateur-trail/index.html',
  '/calculateur-trail/manifest.json'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(FILES);
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(response) {
      // Met à jour le cache avec la dernière version récupérée
      if (response && response.status === 200 && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, copy); });
      }
      return response;
    }).catch(function() {
      // Hors ligne : on sert la version en cache
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('/calculateur-trail/');
      });
    })
  );
});
