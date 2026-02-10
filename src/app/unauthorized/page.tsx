 'use client';

import Link from 'next/link';
import { useSessionStore } from '@/lib/sessionStore';

export default function UnauthorizedPage() {
  const user = useSessionStore((s) => s.user);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surfaceMuted dark:bg-dark-surfaceMuted px-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold">403 - Unauthorized</h1>
        <p className="text-textSecondary dark:text-dark-textSecondary">You do not have permission to access this page.</p>
        {user ? (
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
            Signed in as <span className="font-medium">{user.email}</span>? Please contact the dev team. 
          </p>
        ) : null}
        <Link href="/dashboard" className="inline-block rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90">
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
