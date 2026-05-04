import { useEffect } from 'preact/hooks';
import { pendingAlerts, liveVisitors, conversations, selectedConversationId } from '../state/store.js';

export function Toast() {
  const alerts = pendingAlerts.value;

  // Auto-dismiss oldest alert after 8s
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
        return (
          <div
            key={a.visitorId + a.timestamp}
            role="alert"
            className="bg-orange-500 text-white p-4 rounded shadow-lg max-w-xs cursor-pointer hover:bg-orange-600"
            onClick={() => {
              const conv = Object.values(conversations.value).find((c: any) => c.visitor_id === a.visitorId);
              if (conv) selectedConversationId.value = (conv as any).id;
              pendingAlerts.value = pendingAlerts.value.filter((x) => x !== a);
            }}
          >
            <div className="text-xs font-bold uppercase">Hot lead</div>
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
