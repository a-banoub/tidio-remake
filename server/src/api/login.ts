import { Router } from 'express';
import { OperatorsRepo } from '../repositories/operators.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
import { verifyPassword } from '../auth/password.js';
import { newToken } from '../ids.js';
import type { ServerDeps } from '../server.js';

export function loginRouter(deps: ServerDeps) {
  const router = Router();
  const ops = new OperatorsRepo(deps.db);
  const tokens = new OperatorTokensRepo(deps.db);
  const attempts = new Map<string, { count: number; firstAt: number }>();

  router.post('/login', async (req, res) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const a = attempts.get(ip);
    if (a && now - a.firstAt < 3600_000 && a.count >= 5) return res.status(429).json({ error: 'rate_limited' });

    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'bad_request' });
    const op = ops.findByEmail(email);
    const ok = op && await verifyPassword(password, op.password_hash, deps.env.OPERATOR_PASSWORD_PEPPER);
    if (!ok) {
      const cur = a && now - a.firstAt < 3600_000 ? { count: a.count + 1, firstAt: a.firstAt } : { count: 1, firstAt: now };
      attempts.set(ip, cur);
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const tok = newToken();
    tokens.create(tok, op.id, now);
    return res.json({ token: tok, displayName: op.display_name });
  });
  return router;
}
