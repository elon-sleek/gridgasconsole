'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="w-full max-w-6xl mx-auto">{children}</div>
    </ProtectedRoute>
  );
}
