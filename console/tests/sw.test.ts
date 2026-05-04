// Tests for the service worker source. Vitest runs in jsdom which has no
// ServiceWorkerGlobalScope, so we stub `self` + `caches` + `fetch` and import
// the SW module fresh per test, capturing the listeners it registers.

import { describe, it, expect, beforeEach, vi } from 'vitest';

type Listeners = Record<string, (e: any) => void>;

interface FakeCache {
  addAll: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
}

interface FakeCaches {
  open: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function setupSwGlobals(opts: {
  cacheMatchResult?: Response | undefined;
  fetchResult?: Response;
  fetchImpl?: () => Promise<Response>;
}) {
  const listeners: Listeners = {};

  const cacheStore: FakeCache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(opts.cacheMatchResult),
  };

  const fakeCaches: FakeCaches = {
    open: vi.fn().mockResolvedValue(cacheStore),
    match: vi.fn().mockResolvedValue(opts.cacheMatchResult),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };

  const fakeSelf = {
    addEventListener: (type: string, fn: (e: any) => void) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
    registration: {
      showNotification: vi.fn().mockResolvedValue(undefined),
    },
  };

  // Install on globalThis so the SW source's `self` reference resolves to it.
  Reflect.set(globalThis, 'self', fakeSelf);
  Reflect.set(globalThis, 'caches', fakeCaches);
  const fetchSpy = vi
    .fn()
    .mockImplementation(opts.fetchImpl ?? (() => Promise.resolve(opts.fetchResult ?? new Response('ok'))));
  Reflect.set(globalThis, 'fetch', fetchSpy);

  return { listeners, fakeSelf, fakeCaches, cacheStore, fetchSpy };
}

async function loadSw() {
  vi.resetModules();
  await import('../src/sw.ts');
}

describe('service worker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers install/activate/fetch/push/notificationclick listeners', async () => {
    const { listeners } = setupSwGlobals({});
    await loadSw();
    expect(Object.keys(listeners).sort()).toEqual(
      ['activate', 'fetch', 'install', 'notificationclick', 'push'].sort(),
    );
  });

  it('on install: precaches /console/ and /console/index.html and skips waiting', async () => {
    const { listeners, cacheStore, fakeSelf, fakeCaches } = setupSwGlobals({});
    await loadSw();
    let waited: Promise<unknown> | undefined;
    listeners.install({ waitUntil: (p: Promise<unknown>) => { waited = p; } });
    await waited;
    expect(fakeCaches.open).toHaveBeenCalledWith('tidio-console-v1');
    expect(cacheStore.addAll).toHaveBeenCalledWith(['/console/', '/console/index.html']);
    expect(fakeSelf.skipWaiting).toHaveBeenCalled();
  });

  it('on activate: deletes stale caches and claims clients', async () => {
    const { listeners, fakeCaches, fakeSelf } = setupSwGlobals({});
    fakeCaches.keys.mockResolvedValueOnce(['tidio-console-v1', 'old-cache']);
    await loadSw();
    let waited: Promise<unknown> | undefined;
    listeners.activate({ waitUntil: (p: Promise<unknown>) => { waited = p; } });
    await waited;
    expect(fakeCaches.delete).toHaveBeenCalledWith('old-cache');
    expect(fakeCaches.delete).not.toHaveBeenCalledWith('tidio-console-v1');
    expect(fakeSelf.clients.claim).toHaveBeenCalled();
  });

  it('on fetch: returns cached response when present', async () => {
    const cachedRes = new Response('cached');
    const { listeners } = setupSwGlobals({ cacheMatchResult: cachedRes });
    await loadSw();
    let responded: Promise<Response> | undefined;
    listeners.fetch({
      request: new Request('https://x.example/console/index.html'),
      respondWith: (p: Promise<Response>) => { responded = p; },
    });
    const out = await responded;
    expect(out).toBe(cachedRes);
  });

  it('on fetch: falls back to network on cache miss', async () => {
    const fetched = new Response('fresh', { status: 200 });
    const { listeners, fetchSpy } = setupSwGlobals({
      cacheMatchResult: undefined,
      fetchImpl: () => Promise.resolve(fetched),
    });
    await loadSw();
    let responded: Promise<Response> | undefined;
    listeners.fetch({
      request: new Request('https://x.example/console/'),
      respondWith: (p: Promise<Response>) => { responded = p; },
    });
    const out = await responded;
    expect(out).toBe(fetched);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('on fetch: ignores non-GET requests', async () => {
    const { listeners } = setupSwGlobals({});
    await loadSw();
    const respondWith = vi.fn();
    listeners.fetch({
      request: new Request('https://x.example/console/', { method: 'POST' }),
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  });

  it('on push: shows a notification with parsed payload', async () => {
    const { listeners, fakeSelf } = setupSwGlobals({});
    await loadSw();
    listeners.push({
      data: { json: () => ({ title: 'New chat', body: 'hi', url: '/console/?cid=1' }) },
      waitUntil: (_p: unknown) => {},
    });
    expect(fakeSelf.registration.showNotification).toHaveBeenCalledWith(
      'New chat',
      expect.objectContaining({
        body: 'hi',
        data: { url: '/console/?cid=1' },
        icon: '/console/icons/icon-192.png',
        badge: '/console/icons/icon-192.png',
      }),
    );
  });

  it('on push: falls back to defaults when payload is missing', async () => {
    const { listeners, fakeSelf } = setupSwGlobals({});
    await loadSw();
    listeners.push({ data: null, waitUntil: (_p: unknown) => {} });
    expect(fakeSelf.registration.showNotification).toHaveBeenCalledWith(
      'New chat',
      expect.objectContaining({ body: '', data: { url: '/console/' } }),
    );
  });

  it('on notificationclick: focuses an existing /console window when present', async () => {
    const { listeners, fakeSelf } = setupSwGlobals({});
    const existing = {
      url: 'https://x.example/console/',
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    };
    fakeSelf.clients.matchAll.mockResolvedValueOnce([existing]);
    await loadSw();
    let waited: Promise<unknown> | undefined;
    listeners.notificationclick({
      notification: { close: vi.fn(), data: { url: '/console/?cid=42' } },
      waitUntil: (p: Promise<unknown>) => { waited = p; },
    });
    await waited;
    expect(existing.navigate).toHaveBeenCalledWith('/console/?cid=42');
    expect(existing.focus).toHaveBeenCalled();
    expect(fakeSelf.clients.openWindow).not.toHaveBeenCalled();
  });

  it('on notificationclick: opens a new window when no /console client is open', async () => {
    const { listeners, fakeSelf } = setupSwGlobals({});
    fakeSelf.clients.matchAll.mockResolvedValueOnce([]);
    await loadSw();
    let waited: Promise<unknown> | undefined;
    listeners.notificationclick({
      notification: { close: vi.fn(), data: { url: '/console/?cid=7' } },
      waitUntil: (p: Promise<unknown>) => { waited = p; },
    });
    await waited;
    expect(fakeSelf.clients.openWindow).toHaveBeenCalledWith('/console/?cid=7');
  });
});
