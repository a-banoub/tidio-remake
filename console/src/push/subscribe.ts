function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detectDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
  if (/Android/.test(ua)) return /Pixel/.test(ua) ? 'Pixel' : 'Android';
  if (/iPhone|iPad/.test(ua)) return /iPad/.test(ua) ? 'iPad' : 'iPhone';
  if (/Windows/.test(ua)) return /Edg\//.test(ua) ? 'PC Edge' : 'PC Chrome';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Browser';
}

export type RegisterPushResult = { ok: boolean; reason?: string };

export async function registerPush(token: string): Promise<RegisterPushResult> {
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no_service_worker' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no_push_manager' };

  try {
    const reg = await navigator.serviceWorker.register('/console/sw.js');

    const pkRes = await fetch('/api/operator/push-public-key');
    if (!pkRes.ok) return { ok: false, reason: 'public_key_fetch_failed' };
    const { key } = await pkRes.json();

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const subJson = sub.toJSON();
    const subRes = await fetch('/api/operator/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: subJson.keys,
        deviceLabel: detectDeviceLabel(),
      }),
    });
    if (!subRes.ok) return { ok: false, reason: 'register_failed' };

    return { ok: true };
  } catch (_err) {
    return { ok: false, reason: 'exception' };
  }
}
