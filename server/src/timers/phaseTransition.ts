const PHASE2_DELAY_MS = 3 * 60 * 1000;

export class PhaseTransitionTimers {
  private byConversation = new Map<string, NodeJS.Timeout>();

  start(conversationId: string, onTimeout: () => void): void {
    if (this.byConversation.has(conversationId)) return;
    const t = setTimeout(() => {
      this.byConversation.delete(conversationId);
      onTimeout();
    }, PHASE2_DELAY_MS);
    this.byConversation.set(conversationId, t);
  }

  cancel(conversationId: string): void {
    const t = this.byConversation.get(conversationId);
    if (t) {
      clearTimeout(t);
      this.byConversation.delete(conversationId);
    }
  }
}
