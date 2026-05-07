import { tokenStore } from '../auth/tokenStore.js';

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${tokenStore.get()}`,
});

export type QuickReply = { id: number; label: string; body: string; sort_order: number };

export async function listQuickReplies(): Promise<QuickReply[]> {
  const res = await fetch('/api/operator/quick-replies', { headers: headers() });
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return res.json();
}

export async function createQuickReply(label: string, body: string): Promise<QuickReply> {
  const res = await fetch('/api/operator/quick-replies', {
    method: 'POST', headers: headers(), body: JSON.stringify({ label, body }),
  });
  if (!res.ok) throw new Error(`create failed: ${res.status}`);
  // Server returns { id } only — re-fetch the list entry by listing and picking the new one.
  // We reconstruct a QuickReply from the returned id + the inputs we sent.
  const { id } = await res.json();
  return { id, label, body, sort_order: 0 };
}

export async function updateQuickReply(id: number, patch: { label?: string; body?: string; sort_order?: number }): Promise<QuickReply> {
  const res = await fetch(`/api/operator/quick-replies/${id}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status}`);
  // Server returns { ok: true } — reconstruct from known state.
  return { id, label: patch.label ?? '', body: patch.body ?? '', sort_order: patch.sort_order ?? 0 };
}

export async function deleteQuickReply(id: number): Promise<void> {
  const res = await fetch(`/api/operator/quick-replies/${id}`, {
    method: 'DELETE', headers: headers(),
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
}
