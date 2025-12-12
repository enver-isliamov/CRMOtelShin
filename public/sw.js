
const CACHE_NAME = 'tire-crm-v2'; // Incremented version
const urlsToCache = [
  '/',
  '/index.html',
];

// Install SW
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate the SW
self.addEventListener('activate', (event) => {
  // Claim any clients immediately, so the page is controlled by the new SW immediately
  event.waitUntil(clients.claim());

  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Listen for requests
self.addEventListener('fetch', (event) => {
  // Do not cache Google Script API calls
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  // Network-First Strategy:
  // 1. Try to fetch from network (to get the latest version)
  // 2. If successful, clone response to cache and return it
  // 3. If network fails (offline), return from cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response because it's a stream and can only be consumed once
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Network failed, try to get from cache
        return caches.match(event.request);
      })
  );
});
