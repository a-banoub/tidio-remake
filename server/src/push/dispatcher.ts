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

export type PushPayload = { title: string; body: string; url?: string };

export async function pushToOperator(deps: ServerDeps, operatorId: number, payload: PushPayload): Promise<void> {
  configureVapid(deps);
  const repo = new PushSubscriptionsRepo(deps.db);
  const subs = repo.listForOperator(operatorId);
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      repo.bumpLastUsed(s.id, Date.now());
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        repo.deleteByEndpoint(s.endpoint);
        logger.info({ endpoint: s.endpoint }, 'push subscription expired, cleaned up');
      } else {
        logger.warn({ err: e, endpoint: s.endpoint }, 'push send failed');
      }
    }
  }
}

export function _resetVapidForTests(): void {
  _vapidConfigured = false;
}
