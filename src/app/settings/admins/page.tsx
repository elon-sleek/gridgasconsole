'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { PinGate } from '@/components/PinGate';
import { authedFetch } from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  has_passworded_access: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

export default function AdminManagementPage() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <RouteGuard requiredRole="super_admin">
      <PinGate isUnlocked={unlocked} onUnlock={() => setUnlocked(true)}>
        <AdminManagementInner />
      </PinGate>
    </RouteGuard>
  );
}

function AdminManagementInner() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Fetch all admin users
  const { data: admins, refetch } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  const handleCreateAdmin = () => {
    setShowCreateDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Management</h1>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
            Manage admin accounts and permissions
          </p>
        </div>
        <button
          onClick={handleCreateAdmin}
          className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          + Create Admin
        </button>
      </div>

      {/* Admin Users Table */}
      <div className="card p-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:border-dark-border">
              <th className="text-left py-3 px-2 text-sm font-semibold">Name</th>
              <th className="text-left py-3 px-2 text-sm font-semibold">Email</th>
              <th className="text-left py-3 px-2 text-sm font-semibold">Role</th>
              <th className="text-left py-3 px-2 text-sm font-semibold">Status</th>
              <th className="text-left py-3 px-2 text-sm font-semibold">Passworded Access</th>
              <th className="text-left py-3 px-2 text-sm font-semibold">Created</th>
              <th className="text-left py-3 px-2 text-sm font-semibold">Last Sign In</th>
              <th className="text-right py-3 px-2 text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins?.map((admin) => (
              <tr key={admin.id} className="border-b border-border/50 dark:border-dark-border/50">
                <td className="py-3 px-2 text-sm">{admin.full_name || 'N/A'}</td>
                <td className="py-3 px-2 text-sm">{admin.email}</td>
                <td className="py-3 px-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      admin.role === 'super_admin'
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100'
                        : admin.role === 'admin'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100'
                        : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                    }`}
                  >
                    {admin.role}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      admin.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    {admin.status}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      admin.has_passworded_access
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    {admin.has_passworded_access ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="py-3 px-2 text-sm">
                  {admin.created_at ? new Date(admin.created_at).toLocaleString() : '—'}
                </td>
                <td className="py-3 px-2 text-sm">
                  {admin.last_sign_in_at
                    ? new Date(admin.last_sign_in_at).toLocaleString()
                    : 'Never'}
                </td>
                <td className="py-3 px-2 text-right">
                  <button
                    onClick={() => router.push(`/settings/admins/${admin.id}`)}
                    className="text-primary hover:underline text-sm"
                  >
                    Edit
                  </button>

                  {admin.role !== 'super_admin' && (
                    <button
                      onClick={async () => {
                        const willSuspend = admin.status === 'active';
                        const ok = window.confirm(
                          willSuspend
                            ? `Suspend ${admin.full_name || admin.email}?`
                            : `Unsuspend ${admin.full_name || admin.email}?`
                        );
                        if (!ok) return;

                        const res = await authedFetch(`/api/admin/settings/admins/${admin.id}/update`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ suspended: willSuspend }),
                        });

                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          alert(data?.error || 'Failed to update admin');
                          return;
                        }
                        refetch();
                      }}
                      className="text-primary hover:underline text-sm ml-3"
                    >
                      {admin.status === 'active' ? 'Suspend' : 'Unsuspend'}
                    </button>
                  )}

                  {admin.role !== 'super_admin' && (
                    <button
                      onClick={async () => {
                        const ok = window.confirm(
                          `This will permanently delete ${admin.full_name || admin.email}'s account. Continue?`
                        );
                        if (!ok) return;

                        const res = await authedFetch(`/api/admin/settings/admins/${admin.id}`, {
                          method: 'DELETE',
                        });

                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          alert(data?.error || 'Failed to delete admin');
                          return;
                        }
                        refetch();
                      }}
                      className="text-red-600 hover:underline text-sm ml-3"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Admin Dialog */}
      {showCreateDialog && (
        <CreateAdminDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateAdminDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'support'>('admin');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin && pin !== confirmPin) {
      alert('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/settings/admins/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          role,
          password: password || null,
          pin: pin || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create admin');
      }

      const data = await res.json();

      if (data?.temporary_password) {
        alert(
          `Admin created successfully. Temporary password: ${data.temporary_password}\n\nPlease share it securely and ask the admin to change it immediately.`
        );
      } else {
        alert('Admin created successfully');
      }
      onSuccess();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 max-w-md w-full space-y-4">
        <h2 className="text-lg font-bold">Create Admin User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Full Name</label>
            <input
              type="text"
              required
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Role</label>
            <select
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'support')}
            >
              <option value="admin">Admin</option>
              <option value="support">Support</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Initial Password (optional)</label>
            <input
              type="password"
              minLength={8}
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to auto-generate"
            />
            <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
              If left blank, a temporary password will be generated.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">PIN (optional, for passworded access)</label>
            <input
              type="password"
              minLength={4}
              maxLength={6}
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-6 digits"
            />
          </div>

          {pin && (
            <div>
              <label className="text-sm font-medium">Confirm PIN</label>
              <input
                type="password"
                minLength={4}
                maxLength={6}
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="4-6 digits"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
