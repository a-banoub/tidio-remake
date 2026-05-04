import { selectedConversation, liveVisitors } from '../state/store.js';
import { EditableContact } from '../components/EditableContact.js';
import { LeadScoreBox } from '../components/LeadScoreBox.js';
import { JourneyTimeline } from '../components/JourneyTimeline.js';
import { SourceGeoDevicePanel } from '../components/SourceGeoDevicePanel.js';

export function RightPane() {
  const conv = selectedConversation.value;
  if (!conv) {
    return <aside className="bg-slate-50 p-4 text-xs text-slate-400">Select a conversation</aside>;
  }
  const visitor = liveVisitors.value[conv.visitor_id];
  if (!visitor) return <aside className="bg-slate-50 p-4 text-xs text-slate-400">Visitor offline</aside>;

  return (
    <aside className="bg-white overflow-y-auto p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Visitor details</h3>
      <EditableContact visitor={visitor} />
      <LeadScoreBox visitor={visitor} />
      <JourneyTimeline visitor={visitor} />
      <SourceGeoDevicePanel visitor={visitor} />
    </aside>
  );
}
