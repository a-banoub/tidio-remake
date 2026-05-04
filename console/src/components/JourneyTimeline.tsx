import type { LiveVisitor } from '../state/types.js';
import { visitorDetail } from '../state/visitorDetail.js';

export function JourneyTimeline({ visitor }: { visitor: LiveVisitor }) {
  const detail = visitorDetail.value;
  const pageViews =
    detail && detail.visitor.id === visitor.visitorId ? detail.pageViews : [];

  if (pageViews.length === 0) {
    return (
      <div>
        <h4 className="text-xs uppercase font-semibold text-slate-500 mb-1">Journey</h4>
        <div className="text-xs text-slate-700 border-l-2 border-blue-500 pl-2 py-1 bg-slate-50">
          {visitor.currentPage.url}
        </div>
      </div>
    );
  }

  const currentUrl = visitor.currentPage.url;

  return (
    <div>
      <h4 className="text-xs uppercase font-semibold text-slate-500 mb-1">Journey</h4>
      <ol className="space-y-0">
        {pageViews.map((pv, idx) => {
          const isCurrent = pv.url === currentUrl;
          const isLast = idx === pageViews.length - 1;
          return (
            <li
              key={pv.id}
              data-current={isCurrent ? 'true' : 'false'}
              className="flex items-start gap-2 relative"
            >
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-100 mt-1" />
                {!isLast && (
                  <div className="w-0 border-l-2 border-slate-200 ml-0 flex-1 min-h-4" />
                )}
              </div>
              <div className={`pb-2 pl-1 text-xs ${isCurrent ? 'text-blue-700 font-medium' : 'text-slate-700'}`}>
                <div className="flex items-center gap-1">
                  <span>{pv.title ?? pv.url}</span>
                  {isCurrent && (
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold">
                      now
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">{pv.url}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
