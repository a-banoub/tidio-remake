import { useEffect, useState } from 'preact/hooks';
import { getWs } from '../wsBoot.js';
import type { LiveVisitor } from '../state/types.js';

export function EditableContact({ visitor }: { visitor: LiveVisitor }) {
  const [name, setName] = useState(visitor.name ?? '');
  const [email, setEmail] = useState(visitor.email ?? '');
  const [phone, setPhone] = useState(visitor.phone ?? '');

  // Sync from prop when visitor identity changes
  useEffect(() => {
    setName(visitor.name ?? '');
    setEmail(visitor.email ?? '');
    setPhone(visitor.phone ?? '');
  }, [visitor.visitorId]);

  function flush() {
    getWs()?.send({ type: 'update_visitor', visitorId: visitor.visitorId, name, email, phone });
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-xs uppercase font-semibold text-slate-500">Name</span>
        <input
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onBlur={flush}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase font-semibold text-slate-500">Email</span>
        <input
          type="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          onBlur={flush}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase font-semibold text-slate-500">Phone</span>
        <input
          type="tel"
          value={phone}
          onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
          onBlur={flush}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}
