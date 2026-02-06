'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface dark:bg-dark-surface text-textPrimary dark:text-dark-textPrimary">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-0">
        <Topbar />
        <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6 bg-surfaceMuted dark:bg-dark-surfaceMuted">
          {children}
        </main>
      </div>
    </div>
  );
}
