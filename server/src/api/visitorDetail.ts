import { Router } from 'express';
import { VisitorsRepo } from '../repositories/visitors.js';
import { PageViewsRepo } from '../repositories/pageViews.js';
import { LeadSignalsRepo } from '../repositories/leadSignals.js';
import type { ServerDeps } from '../server.js';
import { requireOperator } from './operatorAuth.js';

export function visitorDetailRouter(deps: ServerDeps) {
  const router = Router();

  router.use(requireOperator(deps));

  router.get('/:id', (req, res) => {
    const visitorId = req.params.id;
    const visitor = new VisitorsRepo(deps.db).findById(visitorId);
    if (!visitor) return res.status(404).json({ error: 'not_found' });

    // Most recent session
    const session = deps.db.prepare(
      'SELECT * FROM sessions WHERE visitor_id = ? ORDER BY started_at DESC LIMIT 1'
    ).get(visitorId);

    let pageViews: any[] = [], leadSignals: any[] = [];
    if (session) {
      pageViews = new PageViewsRepo(deps.db).listForSession((session as any).id);
      leadSignals = new LeadSignalsRepo(deps.db).listForSession((session as any).id);
    }

    const recentConversations = deps.db.prepare(
      'SELECT * FROM conversations WHERE visitor_id = ? ORDER BY last_message_at DESC LIMIT 10'
    ).all(visitorId);

    res.json({ visitor, session, pageViews, leadSignals, recentConversations });
  });

  return router;
}
