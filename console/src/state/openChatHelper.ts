import { conversations, selectedConversationId } from './store.js';
import { getWs } from '../wsBoot.js';

const POLL_INTERVAL_MS = 100;
const TIMEOUT_MS = 3000;

/**
 * Opens a new operator-initiated chat with a visitor, sends a first message,
 * and selects the new conversation. Returns the new conversation ID, or null
 * if the conversation did not appear within the timeout.
 *
 * Used by both the inline history-view composer (MiddlePane) and any other
 * surface that needs to proactively open a chat.
 */
export async function openChatAndSendFirst(
  visitorId: string,
  body: string,
  ws: ReturnType<typeof getWs>,
): Promise<string | null> {
  if (!ws || !body.trim()) return null;

  const startedAt = Date.now();
  ws.send({ type: 'open_chat', visitorId });

  return new Promise<string | null>((resolve) => {
    const interval = setInterval(() => {
      const conv = Object.values(conversations.value).find(
        (c: any) => c.visitor_id === visitorId && c.opened_at >= startedAt - 1000,
      );
      if (conv) {
        ws.send({ type: 'send_message', conversationId: (conv as any).id, body: body.trim() });
        selectedConversationId.value = (conv as any).id;
        clearInterval(interval);
        resolve((conv as any).id);
      } else if (Date.now() - startedAt > TIMEOUT_MS) {
        clearInterval(interval);
        resolve(null);
      }
    }, POLL_INTERVAL_MS);
  });
}
