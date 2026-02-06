'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabaseClient';
import { authedFetch } from '@/lib/api';

export default function AppearancePage() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    try {
      const raw = localStorage.getItem('admin_portal_appearance');
      if (!raw) return 'system';
      const parsed = JSON.parse(raw);
      return parsed?.theme === 'light' || parsed?.theme === 'dark' || parsed?.theme === 'system'
        ? parsed.theme
        : 'system';
    } catch {
      return 'system';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('admin_portal_appearance');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed?.sidebar_collapsed;
    } catch {
      return false;
    }
  });

  const supabase = createClient();
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data: preferences } = useQuery({
    queryKey: ['user-appearance'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('admin_user_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const prefs = data?.preferences || {};
      // DON'T auto-apply, just set state for display
      // User must click Save to apply
      return prefs;
    },
  });

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  // Persist locally (in addition to backend sync)
  useEffect(() => {
    try {
      localStorage.setItem(
        'admin_portal_appearance',
        JSON.stringify({ theme, sidebar_collapsed: sidebarCollapsed })
      );
      window.dispatchEvent(new Event('admin_portal_appearance_changed'));
    } catch {
      // ignore localStorage write failures
    }
  }, [theme, sidebarCollapsed]);

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await authedFetch('/api/admin/settings/appearance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          sidebar_collapsed: sidebarCollapsed,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed to save appearance');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-appearance'] });
      try {
        window.dispatchEvent(new Event('admin_portal_appearance_changed'));
      } catch {
        // ignore
      }
      alert('Appearance settings saved');
    },
    onError: (error: Error) => {
      alert(`Failed to save: ${error.message}`);
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
          Customize how GridGas Board looks and feels
        </p>
      </div>

      {/* Theme Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Theme</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={() => setTheme('light')}
              className="rounded-full"
            />
            <div>
              <div className="text-sm font-medium">☀️ Light Mode</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Bright background with dark text
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={() => setTheme('dark')}
              className="rounded-full"
            />
            <div>
              <div className="text-sm font-medium">🌙 Dark Mode</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Dark background with light text (easier on eyes)
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="theme"
              value="system"
              checked={theme === 'system'}
              onChange={() => setTheme('system')}
              className="rounded-full"
            />
            <div>
              <div className="text-sm font-medium">💻 System</div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Match your operating system's theme
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Sidebar Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Sidebar</h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={sidebarCollapsed}
            onChange={(e) => setSidebarCollapsed(e.target.checked)}
            className="rounded"
          />
          <div>
            <div className="text-sm font-medium">Collapse sidebar by default</div>
            <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
              Show only icons in the navigation sidebar
            </div>
          </div>
        </label>
      </div>

      {/* Language Card (Future) */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Language</h2>
        <div>
          <label className="text-sm font-medium">Display Language</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            disabled
          >
            <option>English (US)</option>
          </select>
          <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
            Additional languages coming soon
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-control bg-primary text-white px-6 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Appearance'}
        </button>
      </div>
    </div>
  );
}
