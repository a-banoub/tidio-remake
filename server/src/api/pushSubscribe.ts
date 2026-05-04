import { Router } from 'express';
import { z } from 'zod';
import { PushSubscriptionsRepo } from '../repositories/pushSubscriptions.js';
import type { ServerDeps } from '../server.js';
import { requireOperator, type OperatorAuthRequest } from './operatorAuth.js';

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceLabel: z.string().max(64).optional(),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url(),
});

export function pushSubscribeRouter(deps: ServerDeps) {
  const router = Router();
  const repo = new PushSubscriptionsRepo(deps.db);

  // Public: browser fetches the VAPID public key before calling subscribe().
  router.get('/push-public-key', (_req, res) => {
    return res.json({ key: deps.env.VAPID_PUBLIC_KEY });
  });

  router.post('/push-subscribe', requireOperator(deps), (req: OperatorAuthRequest, res) => {
    const parsed = SubscribeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const { endpoint, keys, deviceLabel } = parsed.data;
    repo.upsert({
      operator_id: req.operatorId!,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device_label: deviceLabel,
      created_at: Date.now(),
    });
    return res.json({ ok: true });
  });

  router.delete('/push-subscribe', requireOperator(deps), (req: OperatorAuthRequest, res) => {
    const parsed = UnsubscribeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    repo.deleteByEndpoint(parsed.data.endpoint);
    return res.json({ ok: true });
  });

  return router;
}
