import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { CheckInOutPanel } from '../components/attendance/CheckInOutPanel';
import { Card, StatCard, StatGrid } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { attendanceService } from '../services/attendanceService';
import { policyService } from '../services/policyService';
import type { Attendance } from '../types';
import { formatRole } from '../utils/rbac';

export function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [today, setToday] = useState<Attendance | null>(null);
  const [pendingPolicies, setPendingPolicies] = useState(0);

  const loadToday = async () => {
    try {
      const data = await attendanceService.getMy();
      setToday(data.today);
    } catch {
      setToday(null);
    }
  };

  const loadPendingPolicies = async () => {
    try {
      const data = await policyService.getMy('PENDING');
      setPendingPolicies(data.length);
    } catch {
      setPendingPolicies(0);
    }
  };

  useEffect(() => {
    void loadToday();
    void loadPendingPolicies();
  }, []);

  return (
    <div className="dashboard-stack">
      <Card wide>
        <div className="dashboard-welcome">
          <h2>Welcome, {user?.full_name}</h2>
          <p className="muted">{user ? formatRole(user.role) : 'Employee'} self-service portal</p>
        </div>

        {pendingPolicies > 0 ? (
          <div className="ui-alert ui-alert--warning">
            You have {pendingPolicies} pending policy acknowledgement{pendingPolicies > 1 ? 's' : ''}.{' '}
            <Link to="/employee/policies/pending">Review now</Link>
          </div>
        ) : null}

        <StatGrid>
          <StatCard
            label="Today's Status"
            value={today?.status ? today.status.replaceAll('_', ' ') : 'Not checked in'}
            hint="Attendance"
            to="/employee/attendance"
          />
          <StatCard label="My Leaves" value="Apply / Track" hint="Balance & requests" to="/employee/leaves" accent />
          <StatCard
            label="Policies"
            value={pendingPolicies > 0 ? `${pendingPolicies} pending` : 'Up to date'}
            hint="Acknowledgements"
            to="/employee/policies"
          />
        </StatGrid>
      </Card>

      <Card wide padding="md">
        <CheckInOutPanel today={today} onUpdated={() => void loadToday()} compact />
      </Card>
    </div>
  );
}
