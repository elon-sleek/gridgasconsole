'use client';

import { ReactNode } from 'react';
import { RouteGuard } from './RouteGuard';
import { Shell } from './Shell';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredPermission?: string;
};

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  return (
    <RouteGuard requiredPermission={requiredPermission}>
      <Shell>{children}</Shell>
    </RouteGuard>
  );
}
