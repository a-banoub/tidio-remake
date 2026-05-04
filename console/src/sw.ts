/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE = 'tidio-console-v1';
const PRECACHE = ['/console/', '/console/index.html'];

self.addEventListener('install', (e: ExtendableEvent) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e: ExtendableEvent) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e: FetchEvent) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((r) => r ?? fetch(e.request)));
});

self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* ignore malformed payloads */
  }
  const title = data.title ?? 'New chat';
  const options: NotificationOptions & { data: { url: string } } = {
    body: data.body ?? '',
    data: { url: data.url ?? '/console/' },
    icon: '/console/icons/icon-192.png',
    badge: '/console/icons/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && (event.notification.data as { url?: string }).url) || '/console/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients as WindowClient[]) {
        if (c.url.includes('/console') && 'focus' in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

export {};
