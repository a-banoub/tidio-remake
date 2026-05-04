import { Router } from 'express';
import { QuickRepliesRepo } from '../repositories/quickReplies.js';
import type { ServerDeps } from '../server.js';
import { requireOperator, type OperatorAuthRequest } from './operatorAuth.js';

export function quickRepliesRouter(deps: ServerDeps) {
  const router = Router();
  const repo = new QuickRepliesRepo(deps.db);

  router.use(requireOperator(deps));

  router.get('/', (req: OperatorAuthRequest, res) => {
    res.json(repo.list(req.operatorId!));
  });

  router.post('/', (req: OperatorAuthRequest, res) => {
    const { label, body, sort_order } = req.body ?? {};
    if (typeof label !== 'string' || typeof body !== 'string') return res.status(400).json({ error: 'bad_request' });
    const id = repo.create(req.operatorId!, label, body, typeof sort_order === 'number' ? sort_order : 0);
    res.json({ id });
  });

  router.put('/:id', (req: OperatorAuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad_request' });
    const { label, body, sort_order } = req.body ?? {};
    repo.update(id, { label, body, sort_order });
    res.json({ ok: true });
  });

  router.delete('/:id', (req: OperatorAuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad_request' });
    repo.remove(id);
    res.json({ ok: true });
  });

  return router;
}
