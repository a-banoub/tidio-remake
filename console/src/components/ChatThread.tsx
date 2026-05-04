import { useEffect, useRef } from 'preact/hooks';
import type { Message } from '../state/types.js';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function ChatThread({ messages }: { messages: Message[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [messages.length]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 flex flex-col">
      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const showDayDivider = !prev || !isSameDay(prev.sent_at, m.sent_at);
        return (
          <div key={m.id} className="contents">
            {showDayDivider && (
              <div className="self-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold py-2">
                {formatDay(m.sent_at)}
              </div>
            )}
            <div
              className={`flex flex-col max-w-[75%] ${
                m.sender === 'operator' ? 'self-end items-end' : m.sender === 'visitor' ? 'self-start items-start' : 'self-center items-center'
              }`}
            >
              <div
                className={`px-3 py-2 rounded-lg text-sm ${
                  m.sender === 'operator'
                    ? 'bg-blue-600 text-white'
                    : m.sender === 'visitor'
                    ? 'bg-white border border-slate-200'
                    : 'bg-slate-100 text-slate-500 text-xs'
                }`}
              >
                {m.body}
              </div>
              <span
                className="text-[10px] text-slate-400 mt-1 px-1"
                title={new Date(m.sent_at).toLocaleString()}
              >
                {formatTime(m.sent_at)}
              </span>
            </div>
          </div>
        );
      })}
      {messages.length === 0 && <p className="text-center text-xs text-slate-400">No messages yet</p>}
    </div>
  );
}
