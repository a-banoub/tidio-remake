import { useState } from 'preact/hooks';
import { tokenStore } from './tokenStore.js';

export function SetupPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/operator/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, password }),
      });
      if (res.status === 409) {
        window.location.reload();
        return;
      }
      if (!res.ok) {
        setError('Setup failed. Please check the form and try again.');
        return;
      }
      const data = await res.json();
      if (data?.token) {
        tokenStore.set(data.token);
        window.location.reload();
      } else {
        setError('Setup succeeded but no token was returned.');
      }
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
          <h1 className="text-lg font-semibold text-slate-900">First-Run Setup</h1>
          <p className="text-sm text-slate-600">
            Create the first operator account. After this, /api/operator/setup will be locked.
          </p>
        </div>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="setup-email">
              Email
            </label>
            <input
              id="setup-email"
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="setup-name">
              Display name
            </label>
            <input
              id="setup-name"
              type="text"
              value={displayName}
              onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="setup-password">
              Password
            </label>
            <input
              id="setup-password"
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
              minLength={8}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="setup-confirm">
              Confirm password
            </label>
            <input
              id="setup-confirm"
              type="password"
              value={confirm}
              onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
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
          {busy ? 'Creating...' : 'Create operator'}
        </button>
      </form>
    </div>
  );
}
