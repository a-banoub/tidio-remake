import { Router } from 'express';
import { z } from 'zod';
import { OperatorsRepo } from '../repositories/operators.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
import { QuickRepliesRepo } from '../repositories/quickReplies.js';
import { hashPassword } from '../auth/password.js';
import { newToken } from '../ids.js';
import type { ServerDeps } from '../server.js';

const setupBody = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).max(256),
});

export function setupRouter(deps: ServerDeps) {
  const router = Router();
  const ops = new OperatorsRepo(deps.db);
  const tokens = new OperatorTokensRepo(deps.db);

  router.get('/setup-status', (_req, res) => {
    res.json({ needsSetup: ops.countAll() === 0 });
  });

  router.post('/setup', async (req, res) => {
    if (ops.countAll() > 0) {
      return res.status(409).json({ error: 'already_setup' });
    }
    const parsed = setupBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'bad_request' });
    }
    const { email, displayName, password } = parsed.data;
    const now = Date.now();
    const password_hash = await hashPassword(password, deps.env.OPERATOR_PASSWORD_PEPPER);
    const opId = ops.create({ email, password_hash, display_name: displayName, created_at: now });
    const tok = newToken();
    tokens.create(tok, opId, now);
    // Seed on-brand quick-reply defaults for new operators
    const qr = new QuickRepliesRepo(deps.db);
    qr.create(opId, "Hi! I'm Alex — how can I help with your 1031?", "Hi! I'm Alex from Simple 1031 — how can I help with your exchange?", 0);
    qr.create(opId, "Timeline check (45/180-day rules)", "Happy to walk through your timeline (45/180-day rules) — what's the close date on your relinquished property?", 1);
    qr.create(opId, "Send checklist via text", "Want me to text you a quick checklist? Drop your number and I'll send it over.", 2);
    return res.json({ ok: true, token: tok });
  });

  return router;
}
