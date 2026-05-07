import { Router } from 'express';
import { ConversationsRepo } from '../repositories/conversations.js';
import { MessagesRepo } from '../repositories/messages.js';
import type { ServerDeps } from '../server.js';
import { requireOperator } from './operatorAuth.js';

export function closedConversationsRouter(deps: ServerDeps) {
  const router = Router();

  router.use(requireOperator(deps));

  router.get('/closed', (req, res) => {
    const since = parseInt(req.query.since as string, 10);
    if (Number.isNaN(since)) {
      return res.status(400).json({ error: 'invalid_since' });
    }
    const conversations = new ConversationsRepo(deps.db).listRecentlyClosed(since, 100);
    const messagesRepo = new MessagesRepo(deps.db);
    const result = conversations.map((c) => ({
      ...c,
      lastMessages: messagesRepo.listByConversation(c.id, 50),
    }));
    res.json({ conversations: result });
  });

  return router;
}
