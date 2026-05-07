import type { LiveVisitor } from '../state/types.js';
import { visitorDetail } from '../state/visitorDetail.js';

const KIND_LABELS: Record<string, string> = {
  returning_visitor: 'Returning visitor',
  google_ads_click: 'Google Ads click',
  pricing_page_view: 'Viewed pricing',
  calculator_used: 'Used calculator',
  exit_intent: 'Exit intent',
  form_started: 'Started a form',
  high_intent: 'High intent signal',
};

function labelForKind(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function LeadScoreBox({ visitor }: { visitor: LiveVisitor }) {
  const hot = visitor.isHot;
  const detail = visitorDetail.value;
  const showBreakdown =
    detail && detail.visitor.id === visitor.visitorId && detail.leadSignals.length > 0;

  return (
    <div
      className={`p-3 rounded-xl ${
        hot
          ? 'bg-gradient-to-br from-brand-gold to-brand-gold-600 text-white'
          : 'bg-slate-100 text-slate-700'
      }`}
    >
      <div className="text-xs uppercase font-semibold opacity-80">Lead score</div>
      <div className="text-2xl font-bold">{visitor.leadScore}</div>
      {hot && <div className="text-xs mt-1">High priority</div>}
      {showBreakdown && (
        <>
          <div
            className={`mt-2 mb-2 border-t ${
              hot ? 'border-white/30' : 'border-slate-300'
            }`}
          />
          <ul className="space-y-1">
            {detail!.leadSignals.map((s) => (
              <li key={s.id} className="flex justify-between text-xs">
                <span>{labelForKind(s.kind)}</span>
                <span className="font-semibold">+{s.score}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
