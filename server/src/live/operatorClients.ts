import type { WebSocket } from 'ws';

export class OperatorClients {
  private byOperator = new Map<number, Set<WebSocket>>();

  add(operatorId: number, ws: WebSocket): void {
    let s = this.byOperator.get(operatorId);
    if (!s) { s = new Set(); this.byOperator.set(operatorId, s); }
    s.add(ws);
  }

  remove(operatorId: number, ws: WebSocket): void {
    const s = this.byOperator.get(operatorId);
    if (!s) return;
    s.delete(ws);
    if (s.size === 0) this.byOperator.delete(operatorId);
  }

  broadcastTo(operatorId: number, msg: unknown): number {
    const s = this.byOperator.get(operatorId);
    if (!s) return 0;
    const json = JSON.stringify(msg);
    let n = 0;
    for (const ws of s) { try { ws.send(json); n++; } catch {} }
    return n;
  }

  hasAnyConnection(operatorId: number): boolean {
    return (this.byOperator.get(operatorId)?.size ?? 0) > 0;
  }
}
