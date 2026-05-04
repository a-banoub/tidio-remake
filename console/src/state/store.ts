import { signal, computed } from '@preact/signals';
import type { LiveVisitor, Conversation, OperatorStatus, QuickReply } from './types.js';

export const liveVisitors = signal<Record<string, LiveVisitor>>({});
export const conversations = signal<Record<string, Conversation>>({});
export const selectedConversationId = signal<string | null>(null);
export const operatorStatus = signal<OperatorStatus>('online');
export const quickReplies = signal<QuickReply[]>([]);

export const queuedConversations = computed(() => Object.values(conversations.value).filter(c => c.status === 'queued'));
export const liveConversations = computed(() => Object.values(conversations.value).filter(c => c.status === 'live'));

export const selectedConversation = computed(() => {
  const id = selectedConversationId.value;
  if (!id) return null;
  return conversations.value[id] ?? null;
});

export const highPriorityVisitors = computed(() => Object.values(liveVisitors.value).filter(v => v.isHot && !v.conversationId));

export const pendingPing = signal<string | null>(null); // visitorId of the visitor being pinged
export const pendingAlerts = signal<Array<{ visitorId: string; reason: string; timestamp: number }>>([]);

// Per-conversation unread count of visitor messages received while the
// conversation was not selected. Reset to 0 when the conversation is selected.
export const unreadByConversation = signal<Record<string, number>>({});
