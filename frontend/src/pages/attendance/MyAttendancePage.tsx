import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AttendanceTable } from '../../components/attendance/AttendanceTable';
import { CheckInOutPanel } from '../../components/attendance/CheckInOutPanel';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import type { Attendance } from '../../types';
import { getHrMyAttendanceBasePath } from '../../utils/rbac';

export function MyAttendancePage() {
  const { user } = useAuth();
  const location = useLocation();
  const [today, setToday] = useState<Attendance | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const basePath = user ? getHrMyAttendanceBasePath(user.role, user.department) : '/employee/attendance';

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await attendanceService.getMy();
      setToday(data.today);
      setRecords(data.records);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load attendance.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [location.pathname]);

  return (
    <section className="dashboard-card wide">
      <h2>My Attendance</h2>
      <p className="muted">Check in, check out, and review your attendance history.</p>

      {error ? <p className="form-error">{error}</p> : null}

      <CheckInOutPanel today={today} onUpdated={() => void loadData()} />

      <h3>Attendance History</h3>
      {isLoading ? (
        <p>Loading attendance...</p>
      ) : (
        <AttendanceTable
          records={records}
          basePath={basePath}
          showEmployee={false}
        />
      )}
    </section>
  );
}
