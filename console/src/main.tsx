import { render } from 'preact';
import { App } from './App.js';
import './styles.css';

export const CONSOLE_VERSION = '0.1.0';

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

const root = document.getElementById('app');
if (root) render(<App />, root);
