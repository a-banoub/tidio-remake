import type { WebSocket } from 'ws';

export type LivePage = { url: string; title: string | null; enteredAt: number };

export type LiveSession = {
  visitorId: string;
  sockets: Set<WebSocket>;
  activeSessionId: string;
  lastSeenAt: number;
  currentPage: LivePage;
  scrollPct: number;
  leadScore: number;
  isHot: boolean;
  isTyping: boolean;
  conversationId?: string;
};

export class LiveSessions {
  private byVisitor = new Map<string, LiveSession>();

  add(visitorId: string, sessionId: string, socket: WebSocket, page: LivePage): LiveSession {
    let entry = this.byVisitor.get(visitorId);
    if (!entry) {
      entry = {
        visitorId,
        sockets: new Set(),
        activeSessionId: sessionId,
        lastSeenAt: Date.now(),
        currentPage: page,
        scrollPct: 0,
        leadScore: 0,
        isHot: false,
        isTyping: false,
      };
      this.byVisitor.set(visitorId, entry);
    }
    entry.sockets.add(socket);
    entry.activeSessionId = sessionId;
    entry.currentPage = page;
    entry.lastSeenAt = Date.now();
    return entry;
  }

  remove(visitorId: string, socket: WebSocket): void {
    const entry = this.byVisitor.get(visitorId);
    if (!entry) return;
    entry.sockets.delete(socket);
    if (entry.sockets.size === 0) {
      this.byVisitor.delete(visitorId);
    }
  }

  get(visitorId: string): LiveSession | undefined {
    return this.byVisitor.get(visitorId);
  }

  list(): LiveSession[] {
    return Array.from(this.byVisitor.values());
  }

  patch(visitorId: string, patch: Partial<LiveSession>): void {
    const entry = this.byVisitor.get(visitorId);
    if (!entry) return;
    Object.assign(entry, patch, { lastSeenAt: Date.now() });
    entry.isHot = entry.leadScore >= 8;
  }
}
