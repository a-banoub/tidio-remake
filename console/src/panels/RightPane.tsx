import { selectedConversation, liveVisitors } from '../state/store.js';
import { visitorDetail } from '../state/visitorDetail.js';
import { EditableContact } from '../components/EditableContact.js';
import { LeadScoreBox } from '../components/LeadScoreBox.js';
import { JourneyTimeline } from '../components/JourneyTimeline.js';
import { SourceGeoDevicePanel } from '../components/SourceGeoDevicePanel.js';

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function RightPane() {
  const conv = selectedConversation.value;
  if (!conv) {
    return <aside className="bg-slate-50 p-4 text-xs text-slate-400">Select a conversation</aside>;
  }
  const visitor = liveVisitors.value[conv.visitor_id];
  if (!visitor) return <aside className="bg-slate-50 p-4 text-xs text-slate-400">Visitor offline</aside>;

  const detail = visitorDetail.value;
  const showReturningBadge =
    detail && detail.visitor.id === visitor.visitorId && detail.visitCount > 1;

  return (
    <aside className="bg-white overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Visitor details</h3>
        {showReturningBadge && (
          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs uppercase font-semibold">
            RETURNING · {ordinal(detail!.visitCount)} visit
          </span>
        )}
      </div>
      <EditableContact visitor={visitor} />
      <LeadScoreBox visitor={visitor} />
      <JourneyTimeline visitor={visitor} />
      <SourceGeoDevicePanel visitor={visitor} />
    </aside>
  );
}
