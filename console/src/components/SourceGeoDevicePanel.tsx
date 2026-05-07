import type { LiveVisitor } from '../state/types.js';
import { visitorDetail } from '../state/visitorDetail.js';
import { liveVisitors } from '../state/store.js';

const ENGAGEMENT_KINDS = new Set([
  'calculator_used',
  'exit_intent',
  'form_started',
  'high_intent',
]);

const KIND_LABELS: Record<string, string> = {
  calculator_used: 'Used calculator',
  exit_intent: 'Exit intent',
  form_started: 'Started a form',
  high_intent: 'High intent signal',
};

function SectionHeader({ children }: { children: any }) {
  return <h4 className="text-xs uppercase font-semibold text-brand-navy tracking-wide mb-2">{children}</h4>;
}

export function SourceGeoDevicePanel({ visitor }: { visitor: LiveVisitor }) {
  const detail = visitorDetail.value;
  if (!detail || detail.visitor.id !== visitor.visitorId) return null;
  const session = detail.session ?? {};

  // Source
  let channel = 'Direct';
  if (session.gclid) channel = 'Google Ads';
  else if (session.utm_source) channel = session.utm_source;

  const sourceMeta: string[] = [];
  if (session.utm_campaign) sourceMeta.push(session.utm_campaign);
  if (session.utm_term) sourceMeta.push(session.utm_term);

  // Geo
  const geoBits: string[] = [];
  const cityRegion = [session.city, session.region].filter(Boolean).join(', ');
  if (cityRegion) geoBits.push(cityRegion);
  if (session.country) geoBits.push(session.country);
  const geoTop = geoBits.length > 0 ? geoBits.join(' · ') : '—';

  // Device
  const deviceBits = [session.device_type, session.browser, session.os].filter(Boolean);
  const deviceLine = deviceBits.length > 0 ? deviceBits.join(' · ') : '—';

  // Engagement
  const engagementSignals = detail.leadSignals.filter((s) => ENGAGEMENT_KINDS.has(s.kind));
  const liveVisitor = liveVisitors.value[visitor.visitorId];
  const scrollPct = liveVisitor?.scrollPct ?? visitor.scrollPct;

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>Source</SectionHeader>
        <div className="text-sm text-slate-700">{channel}</div>
        {sourceMeta.length > 0 && (
          <div className="text-xs text-slate-500">{sourceMeta.join(' / ')}</div>
        )}
      </div>

      <div>
        <SectionHeader>Geo</SectionHeader>
        <div className="text-sm text-slate-700">{geoTop}</div>
        {session.timezone && <div className="text-xs text-slate-500">{session.timezone}</div>}
      </div>

      <div>
        <SectionHeader>Device</SectionHeader>
        <div className="text-sm text-slate-700">{deviceLine}</div>
      </div>

      <div>
        <SectionHeader>Engagement</SectionHeader>
        <div className="flex flex-wrap gap-1">
          {engagementSignals.map((s) => (
            <span
              key={s.id}
              className="bg-brand-gold-50 text-amber-800 px-2 py-0.5 rounded-full text-xs font-medium"
            >
              {KIND_LABELS[s.kind] ?? s.kind}
            </span>
          ))}
          {typeof scrollPct === 'number' && (
            <span className="bg-brand-emerald-50 text-brand-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">
              Scroll {Math.round(scrollPct)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
