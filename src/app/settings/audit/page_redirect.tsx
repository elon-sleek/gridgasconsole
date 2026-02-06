'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuditPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/audit-logs');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-textSecondary dark:text-dark-textSecondary">Redirecting to audit logs...</p>
    </div>
  );
}
