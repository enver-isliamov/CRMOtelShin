const CACHE_NAME = 'tire-crm-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.css'
];

// Install SW
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate SW
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Listen for fetch requests
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Do not cache API mutating endpoints or non-GET requests
  if (event.request.method !== 'GET' || url.includes('/api/crm') || url.includes('/api/messages')) {
    return;
  }

  // Network-First with Cache Fallback + SPA Navigation Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(async () => {
        // Network failed (offline)
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // If navigating to a route (e.g. /clients, /add-client), serve index.html for React Router
        if (event.request.mode === 'navigate') {
          const indexCached = await caches.match('/index.html') || await caches.match('/');
          if (indexCached) return indexCached;
        }

        return new Response('Офлайн режим: страница не найдена в кэше', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
