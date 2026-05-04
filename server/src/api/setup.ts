import { Router } from 'express';
import { z } from 'zod';
import { OperatorsRepo } from '../repositories/operators.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
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
    return res.json({ ok: true, token: tok });
  });

  return router;
}
