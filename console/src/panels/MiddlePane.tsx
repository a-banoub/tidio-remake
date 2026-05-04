import { selectedConversation, liveVisitors } from '../state/store.js';
import { ChatThread } from '../components/ChatThread.js';
import { Composer } from '../components/Composer.js';
import { QuickRepliesChips } from '../components/QuickRepliesChips.js';

export function MiddlePane() {
  const conv = selectedConversation.value;
  if (!conv) {
    return (
      <main className="flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
        Select a conversation to start
      </main>
    );
  }
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
