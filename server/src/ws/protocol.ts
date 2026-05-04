import { z } from 'zod';

const Page = z.object({ url: z.string().url(), title: z.string().nullable() });
const Utms = z.object({
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
}).strict();

export const VisitorHelloMsg = z.object({
  type: z.literal('hello'),
  visitorId: z.string().regex(/^v_[0-9a-f]{12}$/),
  sessionId: z.string().regex(/^s_[0-9a-f]{12}$/),
  page: Page,
  utms: Utms,
  referrer: z.string().nullable(),
  userAgent: z.string(),
});

export const VisitorPresenceMsg = z.object({
  type: z.literal('presence'),
  page: Page.optional(),
  scrollPct: z.number().int().min(0).max(100).optional(),
  idle: z.boolean().optional(),
});

export const VisitorLeadSignalMsg = z.object({
  type: z.literal('lead_signal'),
  kind: z.string().min(1).max(64),
  payload: z.unknown().optional(),
});

export const VisitorChatOpenMsg = z.object({ type: z.literal('chat_open') });

export const VisitorChatMessageMsg = z.object({
  type: z.literal('chat_message'),
  body: z.string().min(1).max(4000),
});

export const VisitorTypingMsg = z.object({
  type: z.literal('typing'),
  isTyping: z.boolean(),
});

export const VisitorCaptureMsg = z.object({
  type: z.literal('capture'),
  name: z.string().max(200).optional(),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(40).optional(),
});

export const VisitorMessage = z.discriminatedUnion('type', [
  VisitorHelloMsg, VisitorPresenceMsg, VisitorLeadSignalMsg,
  VisitorChatOpenMsg, VisitorChatMessageMsg, VisitorTypingMsg, VisitorCaptureMsg,
]);

export type VisitorMessageT = z.infer<typeof VisitorMessage>;

export function parseVisitorMessage(raw: string): VisitorMessageT | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const result = VisitorMessage.safeParse(parsed);
  return result.success ? result.data : null;
}
