import { liveVisitors, selectedConversationId, queuedConversations, liveConversations, selectedConversation, pendingPing } from '../state/store.js';
import { VisitorRow } from '../components/VisitorRow.js';
import { StatusDropdown } from '../components/StatusDropdown.js';
import { InstallPrompt } from '../components/InstallPrompt.js';

export function LeftPane() {
  const inConv = selectedConversation.value;
  const queued = queuedConversations.value;
  const live = liveConversations.value;
  const allConvVisitorIds = new Set<string>();
  for (const c of [...queued, ...live]) allConvVisitorIds.add(c.visitor_id);
  const liveNotChatting = Object.values(liveVisitors.value).filter(v => !allConvVisitorIds.has(v.visitorId));

  function selectConv(cid: string) { selectedConversationId.value = cid; }

  return (
    <aside className="border-r border-slate-200 bg-white overflow-y-auto">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
        <h1 className="text-sm font-semibold">Console</h1>
        <div className="flex items-center gap-2">
          <InstallPrompt />
          <StatusDropdown />
        </div>
      </header>
      <h2 className="text-xs font-semibold uppercase text-slate-500 px-4 pt-4 pb-2">In conversation</h2>
      {live.length === 0 && <p className="px-4 text-xs text-slate-400">No active chats</p>}
      {live.map(c => liveVisitors.value[c.visitor_id] && (
        <VisitorRow
          key={c.id}
          visitor={liveVisitors.value[c.visitor_id]}
          selected={inConv?.id === c.id}
          lastMessageAt={c.last_message_at}
          onClick={() => selectConv(c.id)}
        />
      ))}

      <h2 className="text-xs font-semibold uppercase text-slate-500 px-4 pt-4 pb-2 border-t border-slate-100">Waiting</h2>
      {queued.map(c => liveVisitors.value[c.visitor_id] && (
        <VisitorRow key={c.id} visitor={liveVisitors.value[c.visitor_id]} selected={inConv?.id === c.id} lastMessageAt={c.last_message_at} onClick={() => selectConv(c.id)} />
      ))}
      {queued.length === 0 && <p className="px-4 text-xs text-slate-400">None</p>}

      <h2 className="text-xs font-semibold uppercase text-slate-500 px-4 pt-4 pb-2 border-t border-slate-100">Live (not chatting)</h2>
      {liveNotChatting.map(v => (
        <VisitorRow key={v.visitorId} visitor={v} onClick={() => { pendingPing.value = v.visitorId; }} />
      ))}
      {liveNotChatting.length === 0 && <p className="px-4 text-xs text-slate-400">No visitors live</p>}
    </aside>
  );
}
