import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { PermissionKey, UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  requiredPermission?: PermissionKey;
  children?: ReactNode;
}

export function ProtectedRoute({
  allowedRoles,
  requiredPermission,
  children,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, can } = useAuth();

  if (isLoading) {
    return (
      <div className="page-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.some((role) => hasRole(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
}
