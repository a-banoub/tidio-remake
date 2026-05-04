import { useEffect, useState, useRef } from 'preact/hooks';
import { getWs } from '../wsBoot.js';
import type { LiveVisitor } from '../state/types.js';

export function EditableContact({ visitor }: { visitor: LiveVisitor }) {
  const [name, setName] = useState(visitor.name ?? '');
  const [email, setEmail] = useState(visitor.email ?? '');
  const [phone, setPhone] = useState(visitor.phone ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(visitor.name ?? '');
    setEmail(visitor.email ?? '');
    setPhone(visitor.phone ?? '');
    setSavedAt(null);
  }, [visitor.visitorId]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const dirty =
    (name !== (visitor.name ?? '')) ||
    (email !== (visitor.email ?? '')) ||
    (phone !== (visitor.phone ?? ''));

  function save() {
    if (!dirty) return;
    getWs()?.send({ type: 'update_visitor', visitorId: visitor.visitorId, name, email, phone });
    setSavedAt(Date.now());
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedAt(null), 2500);
  }

  return (
    <div className="space-y-2" data-testid="editable-contact">
      <label className="block">
        <span className="text-xs uppercase font-semibold text-slate-500">Name</span>
        <input
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase font-semibold text-slate-500">Email</span>
        <input
          type="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase font-semibold text-slate-500">Phone</span>
        <input
          type="tel"
          value={phone}
          onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        {savedAt && <span className="text-xs text-green-600 font-medium" data-testid="saved-indicator">Saved ✓</span>}
        {!savedAt && dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className={`text-sm font-medium px-3 py-1 rounded ${dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          Save
        </button>
      </div>
    </div>
  );
}
