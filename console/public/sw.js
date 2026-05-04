// Phase 8 stub service worker.
// The full SW with caching/strategies arrives in Phase 9.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {}
  const title = data.title || 'Simple 1031';
  const opts = {
    body: data.body || '',
    data: { url: data.url || '/console/' },
    icon: '/console/icons/icon-192.png',
    badge: '/console/icons/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/console/';
  event.waitUntil(self.clients.openWindow(url));
});
