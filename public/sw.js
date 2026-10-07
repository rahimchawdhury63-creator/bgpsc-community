// Service Worker for BGPSC Community
const CACHE_NAME = 'bgpsc-v1';
const STATIC_ASSETS = [
  '/',
  '/brand/logo.png',
  '/manifest.webmanifest',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push notification display
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/brand/logo.png',
    badge: data.badge || '/brand/logo.png',
    tag: data.tag || 'default',
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || {},
    actions: [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click: focus/open window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing window
      for (const client of clients) {
        if (client.url.includes(link) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open a new window
      return self.clients.openWindow(link);
    })
  );
});
