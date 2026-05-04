import { quickReplies } from '../state/store.js';

export function QuickRepliesChips() {
  const replies = quickReplies.value;
  if (replies.length === 0) return null;
  return (
    <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap gap-2">
      {replies.map(r => (
        <button key={r.id} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded">
          {r.label}
        </button>
      ))}
      <button className="text-xs px-2 py-1 text-blue-600 hover:underline">+ Edit chips</button>
    </div>
  );
}
