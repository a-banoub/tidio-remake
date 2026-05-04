import { signal, effect } from '@preact/signals';
import { tokenStore } from '../auth/tokenStore.js';
import { selectedConversation } from './store.js';

export type VisitorDetail = {
  visitor: {
    id: string;
    first_seen_at: number;
    last_seen_at: number;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  session: any | null;
  pageViews: Array<{ id: number; url: string; title: string | null; entered_at: number; scroll_pct: number }>;
  leadSignals: Array<{ id: number; kind: string; payload: string | null; score: number; created_at: number }>;
  recentConversations: any[];
  visitCount: number;
};

export const visitorDetail = signal<VisitorDetail | null>(null);
export const visitorDetailLoading = signal(false);

export async function fetchVisitorDetail(visitorId: string): Promise<void> {
  const token = tokenStore.get();
  if (!token) return;
  visitorDetailLoading.value = true;
  try {
    const res = await fetch(`/api/operator/visitor/${encodeURIComponent(visitorId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      visitorDetail.value = null;
      return;
    }
    visitorDetail.value = await res.json();
  } finally {
    visitorDetailLoading.value = false;
  }
}

let _autoEffectStarted = false;
export function startVisitorDetailAutoFetch(): void {
  if (_autoEffectStarted) return;
  _autoEffectStarted = true;
  effect(() => {
    const conv = selectedConversation.value;
    if (!conv) {
      visitorDetail.value = null;
      return;
    }
    void fetchVisitorDetail(conv.visitor_id);
  });
}
