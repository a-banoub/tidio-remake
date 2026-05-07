import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

// Exposed for tests so they can simulate the browser dispatching
// `beforeinstallprompt` without monkey-patching window listeners.
export const installEvent = signal<any | null>(null);
export const dismissed = signal<boolean>(false);

let _attached = false;
function attachOnce() {
  if (_attached) return;
  _attached = true;
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    installEvent.value = e;
  });
  window.addEventListener('appinstalled', () => {
    installEvent.value = null;
    dismissed.value = true;
  });
}

function isStandaloneNow(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
  if (mql && mql.matches) return true;
  // iOS Safari exposes navigator.standalone instead of the media query.
  return (window.navigator as any).standalone === true;
}

export function InstallPrompt() {
  useEffect(() => {
    attachOnce();
  }, []);

  if (isStandaloneNow() || !installEvent.value || dismissed.value) return null;

  const onInstall = async () => {
    const evt = installEvent.value;
    if (!evt) return;
    try {
      evt.prompt();
      await evt.userChoice;
    } finally {
      installEvent.value = null;
    }
  };

  return (
    <button
      type="button"
      onClick={onInstall}
      className="text-xs px-2 py-1 rounded-lg bg-brand-emerald text-white hover:bg-brand-emerald-600 transition font-semibold"
    >
      Install app
    </button>
  );
}
