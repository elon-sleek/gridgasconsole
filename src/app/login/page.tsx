'use client';

import { useSessionStore } from '@/lib/sessionStore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
      router.refresh();
    }
  }, [user, router]);

  return <LoginForm redirectTo="/dashboard" />;
}
