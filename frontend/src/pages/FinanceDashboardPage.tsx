import { Card, StatCard, StatGrid } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { formatRole } from '../utils/rbac';

export function FinanceDashboardPage() {
  const { user } = useAuth();

  return (
    <Card wide>
      <div className="dashboard-welcome">
        <h2>Welcome, {user?.full_name}</h2>
        <p className="muted">{user ? formatRole(user.role) : 'Finance'} reporting workspace</p>
      </div>

      <StatGrid>
        <StatCard label="Employees" value="View" hint="Read-only directory" to="/finance/employees" />
        <StatCard label="Attendance Summary" value="Reports" hint="Monthly overview" to="/finance/attendance/summary" />
        <StatCard label="Leave Reports" value="LOP & Paid" hint="Approved leaves" to="/finance/leaves/requests" accent />
        <StatCard label="Policies" value="Browse" hint="Company policies" to="/finance/policies" />
      </StatGrid>
    </Card>
  );
}
