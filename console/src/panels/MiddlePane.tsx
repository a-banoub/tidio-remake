import { useState } from 'preact/hooks';
import { selectedConversation, selectedVisitorId, liveVisitors, leftVisitors, closedConversations, pendingPing } from '../state/store.js';
import { visitorDetail } from '../state/visitorDetail.js';
import { ChatThread } from '../components/ChatThread.js';
import { Composer } from '../components/Composer.js';
import { QuickRepliesChips } from '../components/QuickRepliesChips.js';
import { visitorDisplayName } from '../components/VisitorRow.js';
import { openChatAndSendFirst } from '../state/openChatHelper.js';
import { getWs } from '../wsBoot.js';

export function MiddlePane() {
  const [inlineBody, setInlineBody] = useState('');
  const [inlineBusy, setInlineBusy] = useState(false);

  const conv = selectedConversation.value;

  // State B: conversation selected — existing behaviour
  if (conv) {
    const visitor = liveVisitors.value[conv.visitor_id];
    return (
      <main className="flex flex-col bg-white border-r border-slate-200">
        <header className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold">{visitor?.name ?? 'Anonymous'}</h3>
          <p className="text-xs text-slate-500">
            {conv.status === 'queued' ? 'Waiting in queue' : 'Active conversation'}
          </p>
        </header>
        <ChatThread messages={conv.messages} />
        <QuickRepliesChips />
        <Composer conversationId={conv.id} />
      </main>
    );
  }

  // State D: visitor selected and has a closed conversation — render read-only history
  const visitorId = selectedVisitorId.value;
  if (visitorId) {
    const allClosed = Object.values(closedConversations.value);
    const myClosed = allClosed
      .filter(c => c.visitor_id === visitorId)
      .sort((a, b) => b.closed_at - a.closed_at)[0];

    if (myClosed) {
      const visitor = liveVisitors.value[visitorId] ?? leftVisitors.value[visitorId];
      const displayName = visitor ? visitorDisplayName(visitor) : `Visitor #${visitorId.slice(-6)}`;
      const closedTs = new Date(myClosed.closed_at).toLocaleString();

      async function sendInline() {
        if (!inlineBody.trim() || inlineBusy) return;
        setInlineBusy(true);
        const ws = getWs();
        await openChatAndSendFirst(visitorId, inlineBody, ws);
        setInlineBody('');
        setInlineBusy(false);
      }

      return (
        <main className="flex flex-col bg-white border-r border-slate-200">
          <header className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold">{displayName}</h3>
            <p className="text-xs text-slate-500">Closed at {closedTs}</p>
          </header>
          <div className="flex-1 overflow-y-auto opacity-90 px-4 py-3 flex flex-col gap-2">
            {myClosed.lastMessages.map(m => (
              <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender === 'visitor' ? 'bg-slate-100 text-slate-800 self-start' : 'bg-brand-emerald/10 text-brand-emerald-700 self-end ml-auto'}`}>
                {m.body}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 p-3 flex flex-col gap-2">
            <textarea
              value={inlineBody}
              onInput={(e) => setInlineBody((e.target as HTMLTextAreaElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendInline();
                }
              }}
              rows={2}
              placeholder="Start a new chat…"
              disabled={inlineBusy}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition disabled:opacity-50"
            />
            <button
              onClick={() => void sendInline()}
              disabled={inlineBusy || !inlineBody.trim()}
              className="self-end bg-brand-emerald hover:bg-brand-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {inlineBusy ? 'Opening…' : 'Send'}
            </button>
          </div>
        </main>
      );
    }
  }

  // State A: visitor selected but no conversation
  if (visitorId) {
    const visitor = liveVisitors.value[visitorId] ?? leftVisitors.value[visitorId];
    if (!visitor) {
      return (
        <main className="flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
          Visitor not found
        </main>
      );
    }

    const detail = visitorDetail.value;
    const session = detail && detail.visitor.id === visitor.visitorId ? detail.session : null;

    const geoBits = [session?.city, session?.region, session?.country].filter(Boolean);
    const geoLine = geoBits.length > 0 ? geoBits.join(' · ') : null;

    const deviceBits = [session?.device_type, session?.browser, session?.os].filter(Boolean);
    const deviceLine = deviceBits.length > 0 ? deviceBits.join(' · ') : null;

    const displayName = visitorDisplayName(visitor);
    const initial = (visitor.name?.[0] ?? displayName[displayName.length - 1] ?? '?').toUpperCase();

    return (
      <main className="flex items-center justify-center bg-brand-gray p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 w-full max-w-md space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-lg font-semibold">
              {initial}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 truncate">{displayName}</h2>
              <p className="text-xs text-slate-500 truncate">{visitor.currentPage.url}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-lg p-3 ${visitor.isHot ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
              <div className="text-xs uppercase font-semibold opacity-80">Lead Score</div>
              <div className="text-2xl font-bold">{visitor.leadScore}</div>
              {visitor.isHot && <div className="text-xs mt-1">High priority</div>}
            </div>
            <div className="bg-slate-100 text-slate-700 rounded-lg p-3">
              <div className="text-xs uppercase font-semibold opacity-70">Scroll</div>
              <div className="text-2xl font-bold">{Math.round(visitor.scrollPct)}%</div>
            </div>
          </div>

          {geoLine && (
            <div>
              <h4 className="text-xs uppercase font-semibold text-slate-500 mb-1">Location</h4>
              <div className="text-sm text-slate-700">{geoLine}</div>
            </div>
          )}

          {deviceLine && (
            <div>
              <h4 className="text-xs uppercase font-semibold text-slate-500 mb-1">Device</h4>
              <div className="text-sm text-slate-700">{deviceLine}</div>
            </div>
          )}

          <button
            onClick={() => { pendingPing.value = visitorId; }}
            className="w-full bg-brand-emerald hover:bg-brand-emerald-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center"
            style={{ height: '44px' }}
          >
            Start Chat
          </button>
        </div>
      </main>
    );
  }

  // State C: nothing selected
  return (
    <main className="flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
      Select a conversation to start
    </main>
  );
}
