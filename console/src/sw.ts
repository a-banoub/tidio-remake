/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE = 'tidio-console-v2';
const PRECACHE: string[] = [];

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
  const url = new URL(e.request.url);
  // Network-only for API + WebSocket.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;
  // Network-first for the console HTML shell — every reload picks up new asset hashes.
  // We fall back to cache only if the network is offline.
  const isHtml =
    url.pathname === '/console/' ||
    url.pathname === '/console/index.html' ||
    e.request.mode === 'navigate';
  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r ?? Response.error())),
    );
    return;
  }
  // Cache-first for hashed assets (immutable by hash, safe to cache forever).
  e.respondWith(
    caches.match(e.request).then((r) => {
      if (r) return r;
      return fetch(e.request).then((res) => {
        if (res.ok && url.pathname.startsWith('/console/assets/')) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    }),
  );
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
