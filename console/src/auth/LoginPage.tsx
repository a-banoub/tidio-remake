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
      window.location.reload();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-navy">
      <form onSubmit={submit} className="bg-white p-8 rounded-3xl shadow-xl w-96 space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="text-brand-navy">Simple</span>
            <span className="text-brand-emerald">1031</span>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Operator Console</p>
        </div>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-emerald text-white py-2.5 rounded-lg font-semibold hover:bg-brand-emerald-600 disabled:opacity-50 transition"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
