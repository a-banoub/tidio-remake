import { quickReplies } from '../state/store.js';

export function QuickRepliesChips() {
  const replies = quickReplies.value;
  if (replies.length === 0) return null;
  return (
    <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap gap-2 bg-white">
      {replies.map(r => (
        <button key={r.id} className="text-xs px-2.5 py-1 border border-brand-emerald text-brand-emerald bg-white hover:bg-brand-emerald-50 rounded-full font-medium transition">
          {r.label}
        </button>
      ))}
      <button className="text-xs px-2 py-1 text-brand-navy hover:underline font-medium">+ Edit chips</button>
    </div>
  );
}
