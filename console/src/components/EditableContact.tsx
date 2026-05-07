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
    <div className="space-y-3" data-testid="editable-contact">
      <label className="block">
        <span className="text-xs uppercase font-semibold text-brand-navy tracking-wide">Name</span>
        <input
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase font-semibold text-brand-navy tracking-wide">Email</span>
        <input
          type="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase font-semibold text-brand-navy tracking-wide">Phone</span>
        <input
          type="tel"
          value={phone}
          onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
        />
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        {savedAt && <span className="text-xs text-brand-emerald font-medium" data-testid="saved-indicator">Saved ✓</span>}
        {!savedAt && dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition ${dirty ? 'bg-brand-emerald text-white hover:bg-brand-emerald-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          Save
        </button>
      </div>
    </div>
  );
}
