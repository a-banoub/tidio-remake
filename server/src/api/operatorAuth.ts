import type { Request, Response, NextFunction } from 'express';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
import type { ServerDeps } from '../server.js';

export type OperatorAuthRequest = Request & { operatorId?: number };

export function requireOperator(deps: ServerDeps) {
  const tokens = new OperatorTokensRepo(deps.db);
  return (req: OperatorAuthRequest, res: Response, next: NextFunction) => {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
    const token = auth.slice(7);
    const opId = tokens.findOperatorIdByToken(token, Date.now());
    if (!opId) return res.status(401).json({ error: 'unauthorized' });
    req.operatorId = opId;
    next();
  };
}
