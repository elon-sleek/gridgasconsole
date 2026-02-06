'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabaseClient';
import { useSessionStore } from '@/lib/sessionStore';
import { IconAccount } from '@/components/AppIcons';

type NotificationPreferences = {
  email_tickets: boolean;
  sms_escalated: boolean;
  desktop_notifications: boolean;
};

export default function ProfileSettingsPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email_tickets: true,
    sms_escalated: false,
    desktop_notifications: true,
  });

  const supabase = createClient();
  const queryClient = useQueryClient();
  const setSession = useSessionStore((s) => s.setSession);

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get role
      const { data: roleData } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      // Get preferences
      const { data: prefsData } = await supabase
        .from('admin_user_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || 'Admin User',
        avatar_url: (typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null) as string | null,
        role: roleData?.role || 'admin',
        preferences: prefsData?.preferences || {},
      };
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith('image/')) throw new Error('Please select an image file');
      if (!user?.id) throw new Error('Not authenticated');

      setUploadingAvatar(true);

      // Ensure bucket exists (common setup issue in new Supabase projects)
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
      if (token) {
        const ensureRes = await fetch('/api/admin/storage/ensure-avatars', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!ensureRes.ok) {
          const text = await ensureRes.text();
          throw new Error(text ? `Storage setup failed: ${text}` : 'Storage setup failed');
        }
      }

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `admin/${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = publicData?.publicUrl;
      if (!avatarUrl) throw new Error('Failed to create avatar URL');

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });
      if (updateError) throw updateError;

      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session ?? null);

      return avatarUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      alert('Profile photo updated');
    },
    onError: (error: any) => {
      alert(
        `Failed to upload profile photo: ${
          error?.message ??
          'Make sure a Supabase Storage bucket named "avatars" exists and is readable for your users.'
        }`
      );
    },
    onSettled: () => setUploadingAvatar(false),
  });

  // Load preferences
  useEffect(() => {
    if (!user?.preferences) return;
    setTimezone(user.preferences.timezone || 'Africa/Lagos');
    setNotifications({
      email_tickets: user.preferences.notifications?.email_tickets ?? true,
      sms_escalated: user.preferences.notifications?.sms_escalated ?? false,
      desktop_notifications: user.preferences.notifications?.desktop_notifications ?? true,
    });
  }, [user?.preferences]);

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewPassword('');
      setConfirmPassword('');
      alert('Password changed successfully');
    },
    onError: (error: Error) => {
      alert(`Failed to change password: ${error.message}`);
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          notifications,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update preferences');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      alert('Preferences saved successfully');
    },
    onError: (error: Error) => {
      alert(`Failed to save preferences: ${error.message}`);
    },
  });

  const roleKey = (user?.role as 'super_admin' | 'admin' | 'support' | undefined) ?? 'admin';
  const roleDisplay = {
    super_admin: 'Super Administrator',
    admin: 'Administrator',
    support: 'Support Staff',
  }[roleKey];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
          Manage your account settings and preferences
        </p>
      </div>

      {/* User Info Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Account Information</h2>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="Avatar" className="w-16 h-16 object-cover" />
            ) : (
              <IconAccount className="h-8 w-8 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Profile photo</div>
            <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
              Upload an image to show in the top bar.
            </div>
          </div>
          <label className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-4 py-2 text-sm font-semibold hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingAvatar}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                uploadAvatarMutation.mutate(file);
                e.currentTarget.value = '';
              }}
            />
            {uploadingAvatar ? 'Uploading…' : 'Upload'}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-textSecondary dark:text-dark-textSecondary">
              Full Name
            </label>
            <p className="text-sm font-medium">{user?.full_name}</p>
          </div>
          <div>
            <label className="text-xs text-textSecondary dark:text-dark-textSecondary">
              Email
            </label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs text-textSecondary dark:text-dark-textSecondary">
              Role
            </label>
            <p className="text-sm font-medium">{roleDisplay}</p>
          </div>
          <div>
            <label className="text-xs text-textSecondary dark:text-dark-textSecondary">
              User ID
            </label>
            <p className="text-xs font-mono text-textSecondary dark:text-dark-textSecondary">
              {user?.id}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">New Password</label>
            <input
              type="password"
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm New Password</label>
            <input
              type="password"
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>
          <button
            onClick={() => changePasswordMutation.mutate()}
            disabled={changePasswordMutation.isPending || !newPassword || !confirmPassword}
            className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Notification Preferences Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notifications.email_tickets}
              onChange={(e) =>
                setNotifications({ ...notifications, email_tickets: e.target.checked })
              }
              className="rounded"
            />
            <div>
              <div className="text-sm font-medium">Email notifications for assigned tickets</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Receive emails when support tickets are assigned to you
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notifications.sms_escalated}
              onChange={(e) =>
                setNotifications({ ...notifications, sms_escalated: e.target.checked })
              }
              className="rounded"
            />
            <div>
              <div className="text-sm font-medium">SMS for escalated tickets</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Receive SMS when urgent tickets are escalated
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notifications.desktop_notifications}
              onChange={(e) =>
                setNotifications({ ...notifications, desktop_notifications: e.target.checked })
              }
              className="rounded"
            />
            <div>
              <div className="text-sm font-medium">Desktop notifications</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Show browser notifications for important events
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Timezone Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Regional Settings</h2>
        <div>
          <label className="text-sm font-medium">Timezone</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
            <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          </select>
          <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
            All timestamps will be displayed in this timezone
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => updatePreferencesMutation.mutate()}
          disabled={updatePreferencesMutation.isPending}
          className="rounded-control bg-primary text-white px-6 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
