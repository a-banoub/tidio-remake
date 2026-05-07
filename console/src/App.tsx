import { useEffect, useState } from 'preact/hooks';
import { tokenStore } from './auth/tokenStore.js';
import { LoginPage } from './auth/LoginPage.js';
import { SetupPage } from './auth/SetupPage.js';
import { LeftPane } from './panels/LeftPane.js';
import { MiddlePane } from './panels/MiddlePane.js';
import { RightPane } from './panels/RightPane.js';
import { SettingsPage } from './panels/SettingsPage.js';
import { bootWs } from './wsBoot.js';
import { PingModal } from './components/PingModal.js';
import { Toast } from './components/Toast.js';
import { startVisitorDetailAutoFetch } from './state/visitorDetail.js';
import { registerPush } from './push/subscribe.js';
import { requestNotificationPermission, clearUnread } from './notifications.js';

type Route = 'loading' | 'setup' | 'login' | 'main';

export function App() {
  // All hooks at the top — Rules of Hooks
  const [route, setRoute] = useState<Route>('loading');
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/operator/setup-status');
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.needsSetup) {
            setRoute('setup');
            return;
          }
        }
      } catch {
        // Network error — fall through to existing token-based route.
      }
      if (cancelled) return;
      setRoute(tokenStore.get() ? 'main' : 'login');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    if (route === 'main') {
      bootWs();
      startVisitorDetailAutoFetch();
      const tok = tokenStore.get();
      if (tok) {
        registerPush(tok).catch(() => {});
      }
      requestNotificationPermission().catch(() => {});
      const onVisible = () => { if (document.visibilityState === 'visible') clearUnread(); };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
  }, [route]);

  if (route === 'loading') return null;
  if (route === 'setup') return <SetupPage />;
  if (route === 'login') return <LoginPage />;

  // Hash-based routing for authenticated pages — safe, auth gate has passed

  if (hash === '#/settings') return <SettingsPage />;

  return (
    <>
      <div className="grid grid-cols-[280px_1fr_360px] h-screen bg-brand-gray text-slate-900">
        <LeftPane />
        <MiddlePane />
        <RightPane />
      </div>
      <PingModal />
      <Toast />
    </>
  );
}
