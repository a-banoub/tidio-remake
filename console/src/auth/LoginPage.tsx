import { useState } from 'preact/hooks';
import { tokenStore } from './tokenStore.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/operator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 429) { setError('Too many attempts. Try again later.'); return; }
      if (!res.ok) { setError('Invalid email or password.'); return; }
      const { token } = await res.json();
      tokenStore.set(token);
      window.location.hash = '#/';
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="bg-white p-8 rounded-lg shadow-md w-96 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Operator Login</h1>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} required className="w-full border border-slate-300 rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input type="password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} required className="w-full border border-slate-300 rounded px-3 py-2" />
        </div>
        <button type="submit" disabled={busy} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
