import { useEffect, useState } from 'react';

import { CheckInOutPanel } from '../components/attendance/CheckInOutPanel';
import { Card, StatCard, StatGrid } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { attendanceService } from '../services/attendanceService';
import type { Attendance } from '../types';
import { formatRole } from '../utils/rbac';

export function ManagerDashboardPage() {
  const { user } = useAuth();
  const [today, setToday] = useState<Attendance | null>(null);

  const loadToday = async () => {
    try {
      const data = await attendanceService.getMy();
      setToday(data.today);
    } catch {
      setToday(null);
    }
  };

  useEffect(() => {
    void loadToday();
  }, []);

  return (
    <div className="dashboard-stack">
      <Card wide>
        <div className="dashboard-welcome">
          <h2>Welcome, {user?.full_name}</h2>
          <p className="muted">{user ? formatRole(user.role) : 'Manager'} team overview</p>
        </div>

        <StatGrid>
          <StatCard label="Team Attendance" value="View" hint="Daily records" to="/manager/attendance" />
          <StatCard label="Leave Approval" value="Pending" hint="Team requests" to="/manager/leaves/approval" accent />
          <StatCard label="Team Employees" value="Browse" hint="Directory" to="/manager/employees" />
        </StatGrid>
      </Card>

      <Card wide padding="md">
        <CheckInOutPanel today={today} onUpdated={() => void loadToday()} compact />
      </Card>
    </div>
  );
}
