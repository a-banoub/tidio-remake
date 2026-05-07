import { useEffect, useState, useRef } from 'preact/hooks';
import { getWs } from '../wsBoot.js';
import type { LiveVisitor } from '../state/types.js';

export function EditableContact({ visitor }: { visitor: LiveVisitor }) {
  const [name, setName] = useState(visitor.name ?? '');
  const [email, setEmail] = useState(visitor.email ?? '');
  const [phone, setPhone] = useState(visitor.phone ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the last prop value synced into local state so we can detect
  // when the prop changes due to a visitor refresh vs. an operator edit.
  const lastSyncedName = useRef(visitor.name ?? '');
  const lastSyncedEmail = useRef(visitor.email ?? '');
  const lastSyncedPhone = useRef(visitor.phone ?? '');

  // Reset all fields when a DIFFERENT visitor is selected.
  useEffect(() => {
    const n = visitor.name ?? '';
    const e = visitor.email ?? '';
    const p = visitor.phone ?? '';
    setName(n); setEmail(e); setPhone(p);
    lastSyncedName.current = n;
    lastSyncedEmail.current = e;
    lastSyncedPhone.current = p;
    setSavedAt(null);
  }, [visitor.visitorId]);

  // When the SAME visitor reconnects (visitor_appeared / visitor_updated), the
  // prop values may refresh.  If the operator hasn't made an edit since the
  // last save, treat the new prop value as authoritative and sync it in.
  useEffect(() => {
    const propName = visitor.name ?? '';
    if (name === lastSyncedName.current && propName !== lastSyncedName.current) {
      setName(propName);
      lastSyncedName.current = propName;
    }
  }, [visitor.name]);

  useEffect(() => {
    const propEmail = visitor.email ?? '';
    if (email === lastSyncedEmail.current && propEmail !== lastSyncedEmail.current) {
      setEmail(propEmail);
      lastSyncedEmail.current = propEmail;
    }
  }, [visitor.email]);

  useEffect(() => {
    const propPhone = visitor.phone ?? '';
    if (phone === lastSyncedPhone.current && propPhone !== lastSyncedPhone.current) {
      setPhone(propPhone);
      lastSyncedPhone.current = propPhone;
    }
  }, [visitor.phone]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const dirty =
    (name !== (visitor.name ?? '')) ||
    (email !== (visitor.email ?? '')) ||
    (phone !== (visitor.phone ?? ''));

  function save() {
    if (!dirty) return;
    getWs()?.send({ type: 'update_visitor', visitorId: visitor.visitorId, name, email, phone });
    // Update lastSynced to the saved values so the prop-sync effect doesn't
    // clobber the operator's edit on the next visitor_appeared update.
    lastSyncedName.current = name;
    lastSyncedEmail.current = email;
    lastSyncedPhone.current = phone;
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
