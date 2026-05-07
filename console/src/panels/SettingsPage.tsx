import { useState, useEffect } from 'preact/hooks';
import { quickReplies } from '../state/store.js';
import {
  listQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
  type QuickReply,
} from '../api/quickRepliesApi.js';

export function SettingsPage() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listQuickReplies()
      .then((list) => { quickReplies.value = list; })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  async function add() {
    if (!draftLabel.trim() || !draftBody.trim()) return;
    setError(null);
    try {
      const created = await createQuickReply(draftLabel.trim(), draftBody.trim());
      quickReplies.value = [...quickReplies.value, created];
      setDraftLabel('');
      setDraftBody('');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function save(id: number, label: string, body: string) {
    setError(null);
    // Find existing sort_order so we don't clobber it
    const existing = quickReplies.value.find((q) => q.id === id);
    const sort_order = existing?.sort_order ?? 0;
    try {
      const updated = await updateQuickReply(id, { label, body, sort_order });
      quickReplies.value = quickReplies.value.map((q) => (q.id === id ? updated : q));
      setEditingId(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await deleteQuickReply(id);
      quickReplies.value = quickReplies.value.filter((q) => q.id !== id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Quick replies</h1>
        <a href="#/" className="text-sm text-brand-emerald hover:underline">← Back</a>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-3">
        {quickReplies.value.length === 0 && (
          <p className="text-sm text-slate-500">No quick replies yet. Add one below.</p>
        )}
        {quickReplies.value.map((q) => (
          <QuickReplyRow
            key={q.id}
            q={q}
            editing={editingId === q.id}
            onEdit={() => setEditingId(q.id)}
            onSave={save}
            onCancel={() => setEditingId(null)}
            onDelete={() => remove(q.id)}
          />
        ))}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Add new</h2>
        <input
          value={draftLabel}
          onInput={(e) => setDraftLabel((e.target as HTMLInputElement).value)}
          placeholder="Chip label (≤40 chars)"
          maxLength={40}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
        />
        <textarea
          value={draftBody}
          onInput={(e) => setDraftBody((e.target as HTMLTextAreaElement).value)}
          placeholder="Message body"
          rows={3}
          maxLength={2000}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
        />
        <button
          onClick={add}
          className="bg-brand-emerald hover:bg-brand-emerald-600 text-white text-sm font-semibold rounded-lg px-4 py-2"
        >
          Add reply
        </button>
      </div>
    </div>
  );
}

type RowProps = {
  q: QuickReply;
  editing: boolean;
  onEdit: () => void;
  onSave: (id: number, label: string, body: string) => void;
  onCancel: () => void;
  onDelete: () => void;
};

function QuickReplyRow({ q, editing, onEdit, onSave, onCancel, onDelete }: RowProps) {
  const [l, setL] = useState(q.label);
  const [b, setB] = useState(q.body);

  // Sync local draft when entering edit mode (q may have changed since mount)
  useEffect(() => {
    if (editing) {
      setL(q.label);
      setB(q.body);
    }
  }, [editing, q.label, q.body]);

  if (!editing) {
    return (
      <div className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{q.label}</div>
          <div className="text-xs text-slate-600 mt-1 line-clamp-2">{q.body}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="text-xs text-slate-600 hover:text-slate-900 underline">
            Edit
          </button>
          <button onClick={onDelete} className="text-xs text-red-600 hover:text-red-800 underline">
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-brand-emerald rounded-lg p-3 space-y-2">
      <input
        value={l}
        onInput={(e) => setL((e.target as HTMLInputElement).value)}
        maxLength={40}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <textarea
        value={b}
        onInput={(e) => setB((e.target as HTMLTextAreaElement).value)}
        rows={3}
        maxLength={2000}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(q.id, l, b)}
          className="bg-brand-emerald text-white text-xs font-semibold rounded-lg px-3 py-1.5"
        >
          Save
        </button>
        <button onClick={onCancel} className="text-xs text-slate-600 underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
