'use client';

import { IconSettings } from '@/components/AppIcons';

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">General Settings</h1>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
              Organization info, branding, map keys, notification settings, and audit export.
            </p>
          </div>
          <IconSettings className="h-7 w-7 text-primary" />
        </div>
      </div>
    </div>
  );
}
