// build: __BUILD__
// No-op service worker: clears all stale caches on activate, no fetch interception.
// All caching is handled by nginx cache-control headers and the browser's HTTP cache.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});
