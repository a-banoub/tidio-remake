import { useState } from 'preact/hooks';
import { getWs } from '../wsBoot.js';

export function Composer({ conversationId }: { conversationId: string }) {
  const [body, setBody] = useState('');

  function send() {
    const v = body.trim();
    if (!v) return;
    getWs()?.send({ type: 'send_message', conversationId, body: v });
    setBody('');
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      send();
    }
  }

  function onTyping(isTyping: boolean) {
    getWs()?.send({ type: 'typing', conversationId, isTyping });
  }

  return (
    <div className="p-3 border-t border-slate-200 flex gap-2">
      <textarea
        value={body}
        onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
        onFocus={() => onTyping(true)}
        onBlur={() => onTyping(false)}
        onKeyDown={onKeyDown}
        placeholder="Type a reply (Cmd/Ctrl+Enter to send)…"
        rows={2}
        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm resize-none"
      />
      <button onClick={send} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700">Send</button>
    </div>
  );
}
