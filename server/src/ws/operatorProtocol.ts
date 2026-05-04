import { z } from 'zod';

export const OpSubscribeMsg = z.object({
  type: z.literal('subscribe'),
  filters: z.record(z.unknown()).optional(),
});

export const OpSetStatusMsg = z.object({
  type: z.literal('set_status'),
  status: z.enum(['online', 'away', 'dnd']),
});

export const OpOpenChatMsg = z.object({
  type: z.literal('open_chat'),
  visitorId: z.string().regex(/^v_[0-9a-f]{12}$/),
});

export const OpSendMessageMsg = z.object({
  type: z.literal('send_message'),
  conversationId: z.string().regex(/^c_[0-9a-f]{16}$/),
  body: z.string().min(1).max(4000),
  quickReplyId: z.number().int().positive().optional(),
});

export const OpTypingMsg = z.object({
  type: z.literal('typing'),
  conversationId: z.string().regex(/^c_[0-9a-f]{16}$/),
  isTyping: z.boolean(),
});

export const OpMarkSeenMsg = z.object({
  type: z.literal('mark_seen'),
  conversationId: z.string().regex(/^c_[0-9a-f]{16}$/),
  lastMessageId: z.number().int().positive(),
});

// Email is validated only when non-empty so an operator can clear the field.
// Empty strings are treated as "set to NULL" downstream.
const optionalEmailOrEmpty = z.union([z.literal(''), z.string().email().max(254)]).optional();

export const OpUpdateVisitorMsg = z.object({
  type: z.literal('update_visitor'),
  visitorId: z.string().regex(/^v_[0-9a-f]{12}$/),
  name: z.string().max(200).optional(),
  email: optionalEmailOrEmpty,
  phone: z.string().max(40).optional(),
});

export const OpEndChatMsg = z.object({
  type: z.literal('end_chat'),
  conversationId: z.string().regex(/^c_[0-9a-f]{16}$/),
});

export const OperatorMessage = z.discriminatedUnion('type', [
  OpSubscribeMsg, OpSetStatusMsg, OpOpenChatMsg, OpSendMessageMsg,
  OpTypingMsg, OpMarkSeenMsg, OpUpdateVisitorMsg, OpEndChatMsg,
]);

export type OperatorMessageT = z.infer<typeof OperatorMessage>;

export function parseOperatorMessage(raw: string): OperatorMessageT | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const result = OperatorMessage.safeParse(parsed);
  return result.success ? result.data : null;
}
