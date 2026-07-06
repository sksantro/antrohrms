import { useAuth } from '../hooks/useAuth';
import { isSalesMarketingDepartment } from '../utils/rbac';
import { EmployeeDashboardPage } from './EmployeeDashboardPage';
import { SalesMarketingDashboardPage } from './SalesMarketingDashboardPage';

export function EmployeeDashboardRouter() {
  const { user } = useAuth();

  if (isSalesMarketingDepartment(user?.department)) {
    return <SalesMarketingDashboardPage />;
  }

  return <EmployeeDashboardPage />;
}
