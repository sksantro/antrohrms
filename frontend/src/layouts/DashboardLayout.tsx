import { Outlet, useNavigate } from 'react-router-dom';

import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '../hooks/useAuth';

export function DashboardLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppHeader onLogout={() => void handleLogout()} />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
