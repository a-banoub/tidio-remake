import { useEffect, useState } from 'preact/hooks';
import { tokenStore } from './auth/tokenStore.js';
import { LoginPage } from './auth/LoginPage.js';
import { SetupPage } from './auth/SetupPage.js';
import { LeftPane } from './panels/LeftPane.js';
import { MiddlePane } from './panels/MiddlePane.js';
import { RightPane } from './panels/RightPane.js';
import { bootWs } from './wsBoot.js';
import { PingModal } from './components/PingModal.js';
import { Toast } from './components/Toast.js';
import { startVisitorDetailAutoFetch } from './state/visitorDetail.js';
import { registerPush } from './push/subscribe.js';

type Route = 'loading' | 'setup' | 'login' | 'main';

export function App() {
  const [route, setRoute] = useState<Route>('loading');

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
    if (route === 'main') {
      bootWs();
      startVisitorDetailAutoFetch();
      const tok = tokenStore.get();
      if (tok) {
        // Register Web Push in the background; don't block the UI on permission/network.
        registerPush(tok).catch(() => {
          /* swallow — registerPush already returns {ok:false} on failure */
        });
      }
    }
  }, [route]);

  if (route === 'loading') return null;
  if (route === 'setup') return <SetupPage />;
  if (route === 'login') return <LoginPage />;

  return (
    <>
      <div className="grid grid-cols-[280px_1fr_360px] h-screen bg-slate-50 text-slate-900">
        <LeftPane />
        <MiddlePane />
        <RightPane />
      </div>
      <PingModal />
      <Toast />
    </>
  );
}
