import '../styles/globals.css';
import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { QueryProvider } from '@/components/QueryProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'GridGas Board',
  description: 'Admin CRM for FMs, tenants, assets, tariffs, and vend oversight',
  icons: {
    icon: '/assets/Gridgas_logo.png',
    apple: '/assets/Gridgas_logo.png',
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-surface text-textPrimary dark:bg-dark-surface dark:text-dark-textPrimary">
      <body className={inter.className}>
        <ErrorBoundary>
          <QueryProvider>
            <AuthProvider>
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
