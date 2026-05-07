import { useState } from 'preact/hooks';
import { liveVisitors, selectedConversationId, selectedVisitorId, queuedConversations, liveConversations, selectedConversation, unreadByConversation, leftVisitors } from '../state/store.js';
import { VisitorRow } from '../components/VisitorRow.js';
import { StatusDropdown } from '../components/StatusDropdown.js';
import { InstallPrompt } from '../components/InstallPrompt.js';

type TabKey = 'live' | 'waiting' | 'onsite' | 'left';

export function LeftPane() {
  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const inConv = selectedConversation.value;
  const queued = queuedConversations.value;
  const live = liveConversations.value;
  const unread = unreadByConversation.value;
  const left = leftVisitors.value;

  const allConvVisitorIds = new Set<string>();
  for (const c of [...queued, ...live]) allConvVisitorIds.add(c.visitor_id);
  const liveNotChatting = Object.values(liveVisitors.value).filter(v => !allConvVisitorIds.has(v.visitorId));
  const leftList = Object.values(left);

  function selectConv(cid: string) {
    selectedConversationId.value = cid;
    selectedVisitorId.value = null;
    if (unreadByConversation.value[cid]) {
      const next = { ...unreadByConversation.value };
      delete next[cid];
      unreadByConversation.value = next;
    }
  }

  function selectVisitor(visitorId: string) {
    selectedVisitorId.value = visitorId;
    selectedConversationId.value = null;
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'live', label: 'Live', count: live.length },
    { key: 'waiting', label: 'Waiting', count: queued.length },
    { key: 'onsite', label: 'On Site', count: liveNotChatting.length },
    { key: 'left', label: 'Left', count: leftList.length },
  ];

  return (
    <aside className="border-r border-slate-200 bg-white flex flex-col h-full">
      <header className="h-16 px-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-white shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold" style={{ color: '#1B2B4B' }}>Simple</span>
          <span className="text-lg font-bold" style={{ color: '#2E7D52' }}>1031</span>
        </div>
        <div className="flex items-center gap-2">
          <InstallPrompt />
          <StatusDropdown />
        </div>
      </header>

      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shrink-0">
        <div className="flex">
          {tabs.map(t => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={[
                  'flex-1 px-2 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors',
                  isActive ? 'border-[#1B2B4B] text-[#1B2B4B]' : 'border-transparent text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {t.label} ({t.count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'live' && (
          <>
            {live.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No active chats</p>}
            {live.map(c => liveVisitors.value[c.visitor_id] && (
              <VisitorRow
                key={c.id}
                visitor={liveVisitors.value[c.visitor_id]}
                selected={inConv?.id === c.id}
                lastMessageAt={c.last_message_at}
                unread={unread[c.id] ?? 0}
                onClick={() => selectConv(c.id)}
                variant="live"
              />
            ))}
          </>
        )}

        {activeTab === 'waiting' && (
          <>
            {queued.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">None</p>}
            {queued.map(c => liveVisitors.value[c.visitor_id] && (
              <VisitorRow
                key={c.id}
                visitor={liveVisitors.value[c.visitor_id]}
                selected={inConv?.id === c.id}
                lastMessageAt={c.last_message_at}
                unread={unread[c.id] ?? 0}
                onClick={() => selectConv(c.id)}
                variant="queued"
              />
            ))}
          </>
        )}

        {activeTab === 'onsite' && (
          <>
            {liveNotChatting.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No visitors live</p>}
            {liveNotChatting.map(v => (
              <VisitorRow
                key={v.visitorId}
                visitor={v}
                selected={selectedVisitorId.value === v.visitorId}
                onClick={() => selectVisitor(v.visitorId)}
                variant="onsite"
              />
            ))}
          </>
        )}

        {activeTab === 'left' && (
          <>
            {leftList.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No recent visitors</p>}
            {leftList.map(v => (
              <VisitorRow
                key={v.visitorId}
                visitor={v}
                selected={selectedVisitorId.value === v.visitorId}
                onClick={() => selectVisitor(v.visitorId)}
                variant="left"
                leftAt={v.leftAt}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
