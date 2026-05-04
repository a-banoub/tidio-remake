import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stable reference to the original navigator/window state so we can restore.
const origServiceWorker = (navigator as any).serviceWorker;
const origPushManager = (window as any).PushManager;
const origFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  // Restore globals
  if (origServiceWorker === undefined) delete (navigator as any).serviceWorker;
  else Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: origServiceWorker });
  if (origPushManager === undefined) delete (window as any).PushManager;
  else (window as any).PushManager = origPushManager;
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

function setupSwAndPushManager() {
  const subToJSON = { keys: { p256dh: 'PP', auth: 'AA' } };
  const fakeSub = {
    endpoint: 'https://example.com/sub-endpoint',
    toJSON: () => subToJSON,
  };
  const subscribe = vi.fn().mockResolvedValue(fakeSub);
  const getSubscription = vi.fn().mockResolvedValue(null);
  const reg: any = { pushManager: { subscribe, getSubscription } };
  const register = vi.fn().mockResolvedValue(reg);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  });
  (window as any).PushManager = function () {};
  return { register, subscribe, getSubscription, fakeSub };
}

function deleteServiceWorker() {
  if ('serviceWorker' in navigator) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    // Also try to actually delete the property
    try { delete (navigator as any).serviceWorker; } catch {}
  }
}

describe('registerPush', () => {
  it('returns no_service_worker when navigator.serviceWorker is missing', async () => {
    deleteServiceWorker();
    // Ensure 'serviceWorker' not in navigator
    expect('serviceWorker' in navigator).toBe(false);
    const { registerPush } = await import('../../src/push/subscribe.js');
    const res = await registerPush('tok');
    expect(res).toEqual({ ok: false, reason: 'no_service_worker' });
  });

  it('returns no_push_manager when PushManager is missing', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn() } });
    delete (window as any).PushManager;
    const { registerPush } = await import('../../src/push/subscribe.js');
    const res = await registerPush('tok');
    expect(res).toEqual({ ok: false, reason: 'no_push_manager' });
  });

  it('happy path: registers SW, fetches public key, subscribes, POSTs to API', async () => {
    const { register, subscribe, getSubscription, fakeSub } = setupSwAndPushManager();
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (url === '/api/operator/push-public-key') {
        return new Response(JSON.stringify({ key: 'BJhwRs0RltVXa6_MUXXY8Y4V_KwPUMzcbMCSZSlx7iyyqoGolcdPr01qOQsflDi-4dUyjaK3coQ0uCF59z0HUSQ' }), { status: 200 });
      }
      if (url === '/api/operator/push-subscribe') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    globalThis.fetch = fetchMock as any;

    const { registerPush } = await import('../../src/push/subscribe.js');
    const res = await registerPush('mytoken');
    expect(res).toEqual({ ok: true });

    expect(register).toHaveBeenCalledWith('/console/sw.js');
    expect(getSubscription).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls[0][0].userVisibleOnly).toBe(true);
    expect(subscribe.mock.calls[0][0].applicationServerKey).toBeInstanceOf(Uint8Array);

    // Verify the POST body shape
    const postCall = fetchMock.mock.calls.find((c) => c[0] === '/api/operator/push-subscribe');
    expect(postCall).toBeDefined();
    const init = postCall![1];
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer mytoken');
    const body = JSON.parse(init.body);
    expect(body.endpoint).toBe(fakeSub.endpoint);
    expect(body.keys).toEqual({ p256dh: 'PP', auth: 'AA' });
    expect(typeof body.deviceLabel).toBe('string');
  });

  it('reuses existing subscription if one already exists', async () => {
    const { subscribe, getSubscription, fakeSub } = setupSwAndPushManager();
    getSubscription.mockResolvedValue(fakeSub);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/operator/push-public-key') {
        return new Response(JSON.stringify({ key: 'BJhwRs0RltVXa6_MUXXY8Y4V_KwPUMzcbMCSZSlx7iyyqoGolcdPr01qOQsflDi-4dUyjaK3coQ0uCF59z0HUSQ' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock as any;

    const { registerPush } = await import('../../src/push/subscribe.js');
    const res = await registerPush('tok');
    expect(res).toEqual({ ok: true });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('returns public_key_fetch_failed when public key endpoint errors', async () => {
    setupSwAndPushManager();
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('err', { status: 500 })) as any;

    const { registerPush } = await import('../../src/push/subscribe.js');
    const res = await registerPush('tok');
    expect(res).toEqual({ ok: false, reason: 'public_key_fetch_failed' });
  });

  it('returns register_failed when POST /push-subscribe errors', async () => {
    setupSwAndPushManager();
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/operator/push-public-key') {
        return new Response(JSON.stringify({ key: 'BJhwRs0RltVXa6_MUXXY8Y4V_KwPUMzcbMCSZSlx7iyyqoGolcdPr01qOQsflDi-4dUyjaK3coQ0uCF59z0HUSQ' }), { status: 200 });
      }
      return new Response('nope', { status: 500 });
    }) as any;

    const { registerPush } = await import('../../src/push/subscribe.js');
    const res = await registerPush('tok');
    expect(res).toEqual({ ok: false, reason: 'register_failed' });
  });

  it('returns exception when subscribe() throws (e.g., user denied permission)', async () => {
    const { subscribe } = setupSwAndPushManager();
    subscribe.mockRejectedValue(new Error('NotAllowedError'));
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/operator/push-public-key') {
        return new Response(JSON.stringify({ key: 'BJhwRs0RltVXa6_MUXXY8Y4V_KwPUMzcbMCSZSlx7iyyqoGolcdPr01qOQsflDi-4dUyjaK3coQ0uCF59z0HUSQ' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const { registerPush } = await import('../../src/push/subscribe.js');
    const res = await registerPush('tok');
    expect(res).toEqual({ ok: false, reason: 'exception' });
  });
});
