import { useState, useEffect } from 'preact/hooks';
import { pendingPing, liveVisitors, conversations, selectedConversationId } from '../state/store.js';
import { getWs } from '../wsBoot.js';

export function PingModal() {
  const visitorId = pendingPing.value;
  const visitor = visitorId ? liveVisitors.value[visitorId] : null;
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visitor) {
      setBody(`Hi! Saw you reading our content — anything I can help with?`);
    } else {
      setBody('');
    }
  }, [visitorId]);

  if (!visitorId || !visitor) return null;

  function close() { pendingPing.value = null; setBusy(false); }

  function send() {
    if (!body.trim() || busy) return;
    setBusy(true);
    const ws = getWs();
    if (!ws) { close(); return; }
    const startedAt = Date.now();
    ws.send({ type: 'open_chat', visitorId });
    const interval = setInterval(() => {
      // Look for a conversation with this visitor created after startedAt
      const conv = Object.values(conversations.value).find(
        (c: any) => c.visitor_id === visitorId && c.opened_at >= startedAt - 1000
      );
      if (conv) {
        ws.send({ type: 'send_message', conversationId: (conv as any).id, body: body.trim() });
        selectedConversationId.value = (conv as any).id;
        clearInterval(interval);
        close();
      } else if (Date.now() - startedAt > 3000) {
        clearInterval(interval);
        close();
      }
    }, 100);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[480px] p-6 space-y-4">
        <h3 className="text-lg font-semibold">Ping {visitor.name ?? 'visitor'}</h3>
        <p className="text-xs text-slate-500">
          They're on <code className="bg-slate-100 px-1 rounded">{visitor.currentPage.url}</code>
        </p>
        <textarea
          value={body}
          onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
          rows={4}
          className="w-full border border-slate-300 rounded p-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={close} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={busy || !body.trim()}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send ping'}
          </button>
        </div>
      </div>
    </div>
  );
}
