import type { LiveVisitor } from '../state/types.js';

type Props = { visitor: LiveVisitor; onClick: () => void; selected?: boolean; lastMessageAt?: number; unread?: number };

export function visitorDisplayName(v: LiveVisitor): string {
  if (v.name && v.name.trim().length > 0) return v.name;
  // visitorId looks like v_<12 hex>; use last 6 hex as a short stable handle
  const id = v.visitorId ?? '';
  const tail = id.slice(-6);
  return tail ? `Visitor #${tail}` : 'Anonymous';
}

function pageLabel(url: string | undefined | null): string {
  if (!url) return '';
  try {
    const u = new URL(url, 'http://x');
    const path = u.pathname === '/' ? 'Home' : u.pathname;
    return path;
  } catch {
    return url;
  }
}

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function VisitorRow({ visitor, onClick, selected, lastMessageAt, unread }: Props) {
  const hot = visitor.isHot;
  const hasUnread = !!unread && unread > 0;
  const display = visitorDisplayName(visitor);
  const initial = (visitor.name?.[0] ?? display[display.length - 1] ?? '?').toUpperCase();
  const className = [
    'px-4 py-3 flex items-start gap-3 cursor-pointer border-b border-slate-100',
    selected ? 'bg-blue-50' : hasUnread ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50',
    hot && 'border-l-4 border-l-orange-500',
  ].filter(Boolean).join(' ');
  return (
    <div onClick={onClick} className={className}>
      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-900'}`}>{display}</span>
          <div className="flex items-center gap-2 shrink-0">
            {hot && <span className="text-[10px] uppercase font-bold text-orange-600">Hot</span>}
            {hasUnread && (
              <span
                aria-label={`${unread} unread`}
                className="text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
                data-testid="unread-badge"
              >
                {unread! > 99 ? '99+' : unread}
              </span>
            )}
            {lastMessageAt && (
              <span className="text-[10px] text-slate-400" title={new Date(lastMessageAt).toLocaleString()}>
                {relativeTime(lastMessageAt)}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 truncate">{pageLabel(visitor.currentPage.url)}</p>
        <p className="text-[11px] text-slate-400">Score {visitor.leadScore}</p>
      </div>
    </div>
  );
}
