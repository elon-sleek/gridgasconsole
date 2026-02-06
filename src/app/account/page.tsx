'use client';

import { FormEvent, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useSessionStore } from '@/lib/sessionStore';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { getUserRole } from '@/lib/roles';

export default function AccountPage() {
  const user = useSessionStore((s) => s.user);
  const role = getUserRole(user);
  const supabase = getSupabaseClient();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <ProtectedRoute>
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">Manage your profile and settings</p>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-3">Profile Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="font-medium w-24">Email:</span>
                <span className="text-textSecondary dark:text-dark-textSecondary">{user?.email || 'N/A'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium w-24">Role:</span>
                <span className="text-textSecondary dark:text-dark-textSecondary capitalize">{role || 'N/A'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium w-24">User ID:</span>
                <span className="text-textSecondary dark:text-dark-textSecondary text-xs font-mono">{user?.id || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-3">Change Password</h2>
          <form className="space-y-3" onSubmit={handlePasswordChange}>
            <div>
              <label className="text-sm font-medium">New Password</label>
              <input
                type="password"
                required
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm Password</label>
              <input
                type="password"
                required
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
