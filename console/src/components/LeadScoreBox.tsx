import type { LiveVisitor } from '../state/types.js';

export function LeadScoreBox({ visitor }: { visitor: LiveVisitor }) {
  const hot = visitor.isHot;
  return (
    <div
      className={`p-3 rounded-lg ${
        hot
          ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
          : 'bg-slate-100 text-slate-700'
      }`}
    >
      <div className="text-xs uppercase font-semibold opacity-80">Lead score</div>
      <div className="text-2xl font-bold">{visitor.leadScore}</div>
      {hot && <div className="text-xs mt-1">High priority</div>}
    </div>
  );
}
