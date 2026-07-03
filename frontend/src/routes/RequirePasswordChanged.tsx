import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

export function RequirePasswordChanged() {
  const { user, isAuthenticated, isLoading } = useAuth();

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

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
