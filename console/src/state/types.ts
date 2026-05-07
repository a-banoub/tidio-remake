export type OperatorStatus = 'online' | 'away' | 'dnd';

export type LivePage = { url: string; title: string | null; enteredAt: number };

export type LiveVisitor = {
  visitorId: string;
  activeSessionId: string;
  lastSeenAt: number;
  currentPage: LivePage;
  scrollPct: number;
  leadScore: number;
  isHot: boolean;
  isTyping: boolean;
  conversationId?: string;
  socketCount: number;
  // Optional contact fields populated from update_visitor
  name?: string;
  email?: string;
  phone?: string;
};

export type Message = {
  id: number;
  conversation_id: string;
  sender: 'visitor' | 'operator' | 'system';
  body: string;
  sent_at: number;
  seen_at: number | null;
  quick_reply_id: number | null;
};

export type Conversation = {
  id: string;
  visitor_id: string;
  opened_session_id: string | null;
  status: 'live' | 'queued' | 'closed' | 'abandoned' | 'closed_for_followup';
  opened_at: number;
  closed_at: number | null;
  last_message_at: number;
  initiated_by: 'visitor' | 'operator';
  timeout_capture: string | null;
  messages: Message[];
};

export type QuickReply = { id: number; label: string; body: string; sort_order: number };

export type LeftVisitor = LiveVisitor & { leftAt: number; conversationId?: string };

export type ClosedConversation = {
  id: string;
  visitor_id: string;
  opened_session_id: string | null;
  status: 'closed' | 'abandoned' | 'closed_for_followup';
  opened_at: number;
  closed_at: number;
  last_message_at: number;
  initiated_by: 'visitor' | 'operator';
  timeout_capture: string | null;
  lastMessages: Message[];
  last_message_preview: string | null;
};
