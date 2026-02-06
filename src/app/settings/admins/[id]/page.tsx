'use client';

import { useEffect, useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { PinGate } from '@/components/PinGate';

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

export default function EditAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <RouteGuard requiredRole="super_admin">
      <PinGate isUnlocked={unlocked} onUnlock={() => setUnlocked(true)}>
        <EditAdminInner params={params} />
      </PinGate>
    </RouteGuard>
  );
}

function EditAdminInner({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const adminId = resolvedParams.id;
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameInitialized, setNameInitialized] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch admin details
  const { data: admin } = useQuery<AdminUser>({
    queryKey: ['admin-user', adminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_admin_users')
        .select('*')
        .eq('id', adminId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/admin/settings/admins/${adminId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update admin');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', adminId] });
      if (data?.temporary_password) {
        setTempPassword(String(data.temporary_password));
      }
    },
  });

  useEffect(() => {
    if (!admin) return;
    if (nameInitialized) return;
    setEditName(admin.full_name ?? '');
    setNameInitialized(true);
  }, [admin, nameInitialized]);

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const res = await fetch(`/api/admin/settings/admins/${adminId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', adminId] });
      alert('Role updated successfully');
    },
  });

  // Delete admin mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/settings/admins/${adminId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete admin');
      return res.json();
    },
    onSuccess: () => {
      alert('Admin deleted successfully');
      router.push('/settings/admins');
    },
  });

  if (!admin) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-textSecondary dark:text-dark-textSecondary hover:underline mb-2"
        >
          ← Back to Admin Management
        </button>
        <h1 className="text-2xl font-bold">Edit Admin</h1>
      </div>

      {/* Admin Info Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Admin Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-textSecondary dark:text-dark-textSecondary">Name:</span>
            <div className="font-medium">{admin.full_name}</div>
          </div>
          <div>
            <span className="text-textSecondary dark:text-dark-textSecondary">Email:</span>
            <div className="font-medium">{admin.email}</div>
          </div>
          <div>
            <span className="text-textSecondary dark:text-dark-textSecondary">Status:</span>
            <div className="font-medium">{admin.status}</div>
          </div>
          <div>
            <span className="text-textSecondary dark:text-dark-textSecondary">Last Sign In:</span>
            <div className="font-medium">
              {admin.last_sign_in_at
                ? new Date(admin.last_sign_in_at).toLocaleString()
                : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Edit Details</h2>

        <div>
          <label className="text-sm font-medium">Full Name</label>
          <input
            type="text"
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setTempPassword(null);
              updateAdminMutation.mutate({ full_name: editName });
            }}
            disabled={updateAdminMutation.isPending}
            className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {updateAdminMutation.isPending ? 'Saving...' : 'Save Name'}
          </button>
        </div>
      </div>

      {/* Role Management Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Role Management</h2>
        <div>
          <label className="text-sm font-medium">Role</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={admin.role}
            onChange={(e) => updateRoleMutation.mutate(e.target.value)}
            disabled={admin.role === 'super_admin'}
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="support">Support</option>
          </select>
          {admin.role === 'super_admin' && (
            <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
              Super admin role cannot be changed
            </p>
          )}
        </div>
      </div>

      {/* Passworded Access Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Passworded Access</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              PIN Access: {admin.has_passworded_access ? '✅ Granted' : '❌ Not Granted'}
            </div>
            <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
              Required for Vend, Price Settings, Support sections
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPinDialog(true)}
              className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm"
            >
              {admin.has_passworded_access ? 'Change PIN' : 'Set PIN'}
            </button>

            {admin.has_passworded_access && admin.role !== 'super_admin' && (
              <button
                onClick={() => {
                  const ok = window.confirm('Remove passworded access (PIN) for this admin?');
                  if (!ok) return;
                  updateAdminMutation.mutate({ remove_passworded_access: true });
                }}
                disabled={updateAdminMutation.isPending}
                className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm"
              >
                Remove PIN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Controls */}
      {admin.role !== 'super_admin' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Account Controls</h2>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Suspend Account</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Suspended admins cannot sign in.
              </div>
            </div>
            <button
              onClick={() => {
                const willSuspend = admin.status === 'active';
                const ok = window.confirm(
                  willSuspend ? 'Suspend this admin account?' : 'Unsuspend this admin account?'
                );
                if (!ok) return;
                updateAdminMutation.mutate({ suspended: willSuspend });
              }}
              disabled={updateAdminMutation.isPending}
              className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm"
            >
              {admin.status === 'active' ? 'Suspend' : 'Unsuspend'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Force Password Reset</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Generates a new temporary password.
              </div>
            </div>
            <button
              onClick={() => {
                const ok = window.confirm('Generate a new temporary password for this admin?');
                if (!ok) return;
                setTempPassword(null);
                updateAdminMutation.mutate({ force_reset_password: true });
              }}
              disabled={updateAdminMutation.isPending}
              className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm"
            >
              Generate Temp Password
            </button>
          </div>

          {tempPassword && (
            <div className="rounded-control border border-border dark:border-dark-border p-3 text-sm">
              <div className="font-semibold">Temporary password</div>
              <div className="font-mono break-all">{tempPassword}</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
                Share this securely and ask the admin to change it.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Danger Zone Card */}
      {admin.role !== 'super_admin' && (
        <div className="card p-6 space-y-4 border-2 border-red-500">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Delete Admin Account</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                This action cannot be undone
              </div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-control bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              Delete Admin
            </button>
          </div>
        </div>
      )}

      {/* PIN Dialog */}
      {showPinDialog && (
        <PinDialog
          adminId={adminId}
          onClose={() => setShowPinDialog(false)}
          onSuccess={() => {
            setShowPinDialog(false);
            queryClient.invalidateQueries({ queryKey: ['admin-user', adminId] });
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
              Confirm Deletion
            </h2>
            <p className="text-sm">
              Are you sure you want to delete {admin.full_name}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAdminMutation.mutate()}
                disabled={deleteAdminMutation.isPending}
                className="rounded-control bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {deleteAdminMutation.isPending ? 'Deleting...' : 'Delete Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PinDialog({
  adminId,
  onClose,
  onSuccess,
}: {
  adminId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin !== confirmPin) {
      alert('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settings/admins/${adminId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) throw new Error('Failed to set PIN');

      alert('PIN set successfully');
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
        <h2 className="text-lg font-bold">Set Passworded Access PIN</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">New PIN (4-6 digits)</label>
            <input
              type="password"
              required
              minLength={4}
              maxLength={6}
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-6 digits"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Confirm PIN</label>
            <input
              type="password"
              required
              minLength={4}
              maxLength={6}
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="4-6 digits"
            />
          </div>

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
              {loading ? 'Setting...' : 'Set PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
