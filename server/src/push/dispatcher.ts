import webpush from 'web-push';
import { PushSubscriptionsRepo } from '../repositories/pushSubscriptions.js';
import type { ServerDeps } from '../server.js';
import { logger } from '../logger.js';

let _vapidConfigured = false;

function configureVapid(deps: ServerDeps): void {
  if (_vapidConfigured) return;
  webpush.setVapidDetails(
    deps.env.VAPID_SUBJECT,
    deps.env.VAPID_PUBLIC_KEY,
    deps.env.VAPID_PRIVATE_KEY,
  );
  _vapidConfigured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
};

export async function pushToOperator(deps: ServerDeps, operatorId: number, payload: PushPayload): Promise<void> {
  configureVapid(deps);
  const repo = new PushSubscriptionsRepo(deps.db);
  const subs = repo.listForOperator(operatorId);
  for (const s of subs) {
    try {
      const opts: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' } = {};
      if (payload.urgency) opts.urgency = payload.urgency;
      opts.TTL = payload.urgency === 'high' ? 60 : 300;
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        opts,
      );
      repo.recordOk(s.id, Date.now());
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? null;
      if (status === 410 || status === 404) {
        repo.deleteByEndpoint(s.endpoint);
        logger.info({ endpoint: s.endpoint }, 'push subscription expired, cleaned up');
      } else {
        repo.recordFail(s.id, String(e?.message ?? status ?? 'unknown'), Date.now());
        logger.warn({ err: e, subId: s.id }, 'push send failed');
      }
    }
  }
}

export function _resetVapidForTests(): void {
  _vapidConfigured = false;
}
