import { render } from 'preact';
import { App } from './App.js';
import { pendingPing } from './state/store.js';
import './styles.css';

export const CONSOLE_VERSION = '0.1.0';

const VISITOR_ID_RE = /^v_[0-9a-f]{12}$/;

/**
 * Read `?ping=<visitorId>` from the URL and seed `pendingPing` so the
 * PingModal opens. Service-worker push notifications use this URL form to
 * deep-link the operator to a specific visitor.
 *
 * Strips the param from the URL after consuming it so a manual reload
 * doesn't keep re-triggering the modal.
 *
 * Exported for tests.
 */
export function applyPingUrlParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const ping = url.searchParams.get('ping');
  if (!ping) return;
  if (VISITOR_ID_RE.test(ping)) {
    pendingPing.value = ping;
  }
  url.searchParams.delete('ping');
  history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
}

// Register the service worker as early as possible — required for Android
// Chrome to surface the "Install app" prompt and for offline shell caching.
// Push subscription happens later, after login, in registerPush().
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/console/sw.js').catch(() => {
      /* swallow — push registration will retry post-login */
    });
  });
}

applyPingUrlParam();

const root = document.getElementById('app');
if (root) render(<App />, root);
