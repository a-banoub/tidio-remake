import { useEffect } from 'preact/hooks';
import { pendingAlerts, pendingPing, liveVisitors, conversations, selectedConversationId } from '../state/store.js';

type AlertStyle = { label: string; bg: string };

function styleFor(reason: string): AlertStyle {
  switch (reason) {
    case 'lead_score_8': return { label: 'Hot lead', bg: 'bg-orange-500 hover:bg-orange-600' };
    case 'warm_visitor': return { label: 'Warm visitor', bg: 'bg-blue-500 hover:bg-blue-600' };
    default: return { label: 'Alert', bg: 'bg-slate-500 hover:bg-slate-600' };
  }
}

export function Toast() {
  const alerts = pendingAlerts.value;

  useEffect(() => {
    if (alerts.length === 0) return;
    const t = setTimeout(() => {
      pendingAlerts.value = pendingAlerts.value.slice(1);
    }, 8000);
    return () => clearTimeout(t);
  }, [alerts.length]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {alerts.map((a) => {
        const v = liveVisitors.value[a.visitorId];
        const { label, bg } = styleFor(a.reason);
        return (
          <div
            key={a.visitorId + a.timestamp}
            role="alert"
            className={`${bg} text-white p-4 rounded shadow-lg max-w-xs cursor-pointer`}
            onClick={() => {
              const conv = Object.values(conversations.value).find((c: any) => c.visitor_id === a.visitorId);
              if (conv) {
                selectedConversationId.value = (conv as any).id;
              } else {
                pendingPing.value = a.visitorId;
              }
              pendingAlerts.value = pendingAlerts.value.filter((x) => x !== a);
            }}
          >
            <div className="text-xs font-bold uppercase">{label}</div>
            <div className="text-sm mt-1">
              {v ? `${v.name ?? 'Anonymous'} on ${v.currentPage.url}` : a.visitorId}
            </div>
            <div className="text-xs opacity-80 mt-1">{a.reason}</div>
          </div>
        );
      })}
    </div>
  );
}
