import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';

export function handleVisitorConnection(ws: WebSocket, _req: IncomingMessage, _deps: ServerDeps): void {
  ws.on('message', () => { /* implemented in Task 2.4 */ });
  ws.on('close', () => { /* implemented in Task 2.4 */ });
}
