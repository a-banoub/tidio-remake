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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="bg-white p-8 rounded-lg shadow-md w-96 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">First-Run Setup</h1>
        <p className="text-sm text-slate-600">
          Create the first operator account. After this, /api/operator/setup will be locked.
        </p>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="setup-email">
            Email
          </label>
          <input
            id="setup-email"
            type="email"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            required
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="setup-name">
            Display name
          </label>
          <input
            id="setup-name"
            type="text"
            value={displayName}
            onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
            required
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="setup-password">
            Password
          </label>
          <input
            id="setup-password"
            type="password"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            required
            minLength={8}
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="setup-confirm">
            Confirm password
          </label>
          <input
            id="setup-confirm"
            type="password"
            value={confirm}
            onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
            required
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Creating...' : 'Create operator'}
        </button>
      </form>
    </div>
  );
}
