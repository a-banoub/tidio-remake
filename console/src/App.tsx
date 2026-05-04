import { useEffect } from 'preact/hooks';
import { tokenStore } from './auth/tokenStore.js';
import { LoginPage } from './auth/LoginPage.js';
import { LeftPane } from './panels/LeftPane.js';
import { MiddlePane } from './panels/MiddlePane.js';
import { RightPane } from './panels/RightPane.js';
import { bootWs } from './wsBoot.js';
import { PingModal } from './components/PingModal.js';
import { Toast } from './components/Toast.js';

function getRoute(): 'login' | 'main' {
  return tokenStore.get() ? 'main' : 'login';
}

export function App() {
  const route = getRoute();
  useEffect(() => { if (route === 'main') bootWs(); }, [route]);

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
