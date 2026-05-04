import type { LiveVisitor } from '../state/types.js';

type Props = { visitor: LiveVisitor; onClick: () => void; selected?: boolean };

export function VisitorRow({ visitor, onClick, selected }: Props) {
  const hot = visitor.isHot;
  const className = [
    'px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100',
    selected && 'bg-blue-50',
    hot && 'border-l-4 border-l-orange-500',
  ].filter(Boolean).join(' ');
  return (
    <div onClick={onClick} className={className}>
      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
        {(visitor.name?.[0] ?? '?').toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-900 truncate">{visitor.name ?? 'Anonymous'}</span>
          {hot && <span className="text-[10px] uppercase font-bold text-orange-600">Hot</span>}
        </div>
        <p className="text-xs text-slate-500 truncate">{visitor.currentPage.url}</p>
        <p className="text-[11px] text-slate-400">Score {visitor.leadScore}</p>
      </div>
    </div>
  );
}
