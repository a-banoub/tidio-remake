import { liveVisitors, selectedConversationId, queuedConversations, liveConversations, selectedConversation } from '../state/store.js';
import { VisitorRow } from '../components/VisitorRow.js';

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
      <h2 className="text-xs font-semibold uppercase text-slate-500 px-4 pt-4 pb-2">In conversation</h2>
      {inConv && liveVisitors.value[inConv.visitor_id] && (
        <VisitorRow visitor={liveVisitors.value[inConv.visitor_id]} selected onClick={() => {}} />
      )}
      {!inConv && <p className="px-4 text-xs text-slate-400">No conversation selected</p>}

      <h2 className="text-xs font-semibold uppercase text-slate-500 px-4 pt-4 pb-2 border-t border-slate-100">Waiting</h2>
      {queued.map(c => liveVisitors.value[c.visitor_id] && (
        <VisitorRow key={c.id} visitor={liveVisitors.value[c.visitor_id]} onClick={() => selectConv(c.id)} />
      ))}
      {queued.length === 0 && <p className="px-4 text-xs text-slate-400">None</p>}

      <h2 className="text-xs font-semibold uppercase text-slate-500 px-4 pt-4 pb-2 border-t border-slate-100">Live (not chatting)</h2>
      {liveNotChatting.map(v => (
        <VisitorRow key={v.visitorId} visitor={v} onClick={() => {}} />
      ))}
      {liveNotChatting.length === 0 && <p className="px-4 text-xs text-slate-400">No visitors live</p>}
    </aside>
  );
}
