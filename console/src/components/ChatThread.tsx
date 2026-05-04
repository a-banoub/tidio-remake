import { useEffect, useRef } from 'preact/hooks';
import type { Message } from '../state/types.js';

export function ChatThread({ messages }: { messages: Message[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [messages.length]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
      {messages.map(m => (
        <div
          key={m.id}
          className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
            m.sender === 'operator'
              ? 'self-end bg-blue-600 text-white ml-auto'
              : m.sender === 'visitor'
              ? 'bg-white border border-slate-200 mr-auto'
              : 'mx-auto bg-slate-100 text-slate-500 text-xs'
          }`}
        >
          {m.body}
        </div>
      ))}
      {messages.length === 0 && <p className="text-center text-xs text-slate-400">No messages yet</p>}
    </div>
  );
}
