'use client';

import { FormEvent, ReactNode, useState } from 'react';

type PinGateProps = {
  children: ReactNode;
  onUnlock: () => void;
  isUnlocked: boolean;
  /** Optional header to show above the lock (visible even when locked) */
  header?: ReactNode;
};

export function PinGate({ children, onUnlock, isUnlocked, header }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        setError('Incorrect PIN');
        return;
      }

      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!json?.ok) {
        setError('Incorrect PIN');
        return;
      }

      onUnlock();
    } catch {
      setError('Unable to verify PIN');
    } finally {
      setSubmitting(false);
    }
  }

  if (isUnlocked) return <>{header}{children}</>;

  return (
    <div className="space-y-6">
      {header}
      <div className="card p-6 max-w-md mx-auto space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Restricted Access</h2>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">Enter admin PIN to continue.</p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">PIN</label>
            <input
              type="password"
              required
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-control bg-primary text-white py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Verifying…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
