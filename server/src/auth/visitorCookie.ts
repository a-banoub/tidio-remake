import { createHmac, timingSafeEqual } from 'node:crypto';

export type VisitorCookiePayload = { visitorId: string; sessionId: string; issuedAt: number };

export function signVisitorCookie(visitorId: string, sessionId: string, secret: string): string {
  const issuedAt = Date.now();
  const payload = `${visitorId}.${sessionId}.${issuedAt}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyVisitorCookie(token: string, secret: string): VisitorCookiePayload | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [visitorId, sessionId, issuedAtStr, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${visitorId}.${sessionId}.${issuedAtStr}`).digest('hex');
  const a = Buffer.from(sig, 'hex'), b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return null;
  return { visitorId, sessionId, issuedAt };
}
