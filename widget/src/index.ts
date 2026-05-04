import { getOrCreateVisitorId, newSessionId } from './identity.js';
import { parseUtms } from './utms.js';
import { ChatWS } from './ws.js';
import { ConvStore } from './storage.js';
import { injectStyles } from './styles.js';
import { WidgetUI } from './ui.js';

export const WIDGET_VERSION = '0.1.0';

declare global { interface Window { TidioRemakeConfig?: { wsUrl?: string }; } }

const DEFAULT_WS_URL = 'wss://chat.simple1031x.com/ws/visitor';

function init() {
  if ((window as any).__s1031WidgetMounted) return;
  (window as any).__s1031WidgetMounted = true;

  injectStyles();

  const visitorId = getOrCreateVisitorId();
  const sessionId = newSessionId();
  const store = new ConvStore();

  let conversationId: string | undefined;

  const ui = new WidgetUI({
    onOpen: () => ws.send({ type: 'chat_open' }),
    onClose: () => {},
    onSend: (body) => {
      ws.send({ type: 'chat_message', body });
      const stored = store.load() ?? { messages: [], openedAt: Date.now(), conversationId };
      stored.messages.push({ id: `local-${Date.now()}`, sender: 'visitor', body, sent_at: Date.now() });
      stored.conversationId = conversationId;
      store.save(stored);
    },
    onSubmitCapture: (data) => ws.send({ type: 'capture', ...data }),
  });

  const wsUrl = window.TidioRemakeConfig?.wsUrl ?? DEFAULT_WS_URL;

  const ws = new ChatWS(wsUrl, {
    onOpen: () => {
      ws.send({
        type: 'hello', visitorId, sessionId,
        page: { url: location.href, title: document.title },
        utms: parseUtms(location.search),
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
      });
    },
    onMessage: (m) => {
      switch (m.type) {
        case 'welcome':
          conversationId = m.conversationId;
          ui.mount(!!m.operatorOnline);
          if (Array.isArray(m.history)) {
            for (const h of m.history) ui.showMessage({ sender: h.sender, body: h.body });
          }
          break;
        case 'operator_message':
          ui.showMessage({ sender: 'operator', body: m.body });
          break;
        case 'operator_typing':
          ui.showOperatorTyping(!!m.isTyping);
          break;
        case 'operator_pinged_you':
          ui.open();
          ui.showMessage({ sender: 'system', body: '🔔 Alex jumped in to help' });
          ui.showMessage({ sender: 'operator', body: m.body });
          break;
        case 'phase_transition':
          ui.enterCapturePhase(m.phase === 'email_on_file' ? m.knownEmail : null);
          break;
        case 'seen':
          break;
      }
    },
    onClose: () => {},
  });

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      ws.send({ type: 'presence', page: { url: location.href, title: document.title }, scrollPct: scrollPct() });
    }
  }, 15000);
}

function scrollPct(): number {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  if (total <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / total) * 100));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
