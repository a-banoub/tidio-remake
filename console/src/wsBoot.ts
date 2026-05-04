import { OperatorWS } from './ws/operatorClient.js';
import { tokenStore } from './auth/tokenStore.js';
import { applyWsMessage } from './state/reducers.js';

let ws: OperatorWS | null = null;

export function getWs() { return ws; }

export function bootWs() {
  if (ws) return;
  const token = tokenStore.get();
  if (!token) return;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/operator`;
  ws = new OperatorWS(url, token, {
    onOpen: () => { ws!.send({ type: 'subscribe' }); },
    onMessage: (m) => applyWsMessage(m),
    onClose: () => {},
  });
}
