'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSessionStore } from '@/lib/sessionStore';
import { createClient } from '@/lib/supabaseClient';

export default function AboutPage() {
  const accessToken = useSessionStore((s) => s.session?.access_token ?? null);
  const supabase = createClient();

  const { data: appInfo } = useQuery<{ name: string; version: string; copyright: string }>({
    queryKey: ['admin-app-info', accessToken],
    queryFn: async () => {
      const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token ?? null;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/app-info', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load app info');
      return (await res.json()) as { name: string; version: string; copyright: string };
    },
    enabled: true,
  });

  const brandingMail = useMemo(() => {
    const appName = appInfo?.name ?? 'GridGas Board';
    const subject = `Branding Change Request (${appName})`;
    const body =
      `Hello,\n\nPlease help with a branding change request for ${appName}.\n\n` +
      `Details:\n- Requested change:\n- Reason:\n- Requested by:\n\nThanks.`;
    const mailto =
      'mailto:support@gridgas.network' +
      '?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body);
    return { subject, body, mailto };
  }, [appInfo?.name]);

  const handleBrandingRequest = async () => {
    // 1) Try opening email client.
    try {
      window.location.href = brandingMail.mailto;
    } catch {
      // Ignore
    }

    // 2) Always provide a fallback that works even without an email client.
    const fallbackText =
      `To: support@gridgas.network\nSubject: ${brandingMail.subject}\n\n${brandingMail.body}`;
    try {
      await navigator.clipboard.writeText(fallbackText);
      alert('Branding request details copied. Paste into an email to support@gridgas.network.');
    } catch {
      alert('If your email app did not open, email support@gridgas.network for branding changes.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h1 className="text-2xl font-semibold">About</h1>
        <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
          {(appInfo?.name ?? 'GridGas Board')} is an internal administration portal for LPG operations.
        </p>
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Application</h2>
        <div className="text-sm">
          <span className="text-textSecondary dark:text-dark-textSecondary">Version:</span>{' '}
          <span className="font-mono">{appInfo?.version ?? '—'}</span>
        </div>
        <div className="text-sm">
          <span className="text-textSecondary dark:text-dark-textSecondary">Copyright:</span>{' '}
          <span>{appInfo?.copyright ?? '—'}</span>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleBrandingRequest}
            className="inline-flex items-center justify-center rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-4 py-2 text-sm font-semibold hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
          >
            Request Branding Change
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Support</h2>
        <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
          For access issues or operational support, contact your system administrator.
        </p>
        <div className="text-sm">
          <span className="text-textSecondary dark:text-dark-textSecondary">Email:</span>{' '}
          <a href="mailto:support@gridgas.network" className="text-primary hover:underline">
            support@gridgas.network
          </a>
        </div>
      </div>
    </div>
  );
}
