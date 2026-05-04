import type { LiveVisitor } from '../state/types.js';

export function JourneyTimeline({ visitor }: { visitor: LiveVisitor }) {
  return (
    <div>
      <h4 className="text-xs uppercase font-semibold text-slate-500 mb-1">Journey</h4>
      <div className="text-xs text-slate-700 border-l-2 border-blue-500 pl-2 py-1 bg-slate-50">
        {visitor.currentPage.url}
      </div>
    </div>
  );
}
