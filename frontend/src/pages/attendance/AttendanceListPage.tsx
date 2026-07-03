import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { AttendanceTable } from '../../components/attendance/AttendanceTable';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import type { Attendance, AttendanceFilters, AttendanceStatus } from '../../types';
import { getAttendanceBasePath } from '../../utils/rbac';

const statusOptions: AttendanceStatus[] = [
  'PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY',
];

export function AttendanceListPage() {
  const { user, can } = useAuth();
  const location = useLocation();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AttendanceFilters>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: '',
    department: '',
  });

  const basePath = user ? getAttendanceBasePath(user.role) : '/admin/attendance';
  const canManage = can('can_manage_attendance');
  const showEmployee = can('can_view_all_attendance') || can('can_view_team_attendance');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await attendanceService.list(filters);
        setRecords(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load attendance.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [location.pathname, filters]);

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>Attendance List</h2>
          <p className="muted">Review attendance records by filters.</p>
        </div>
        {canManage ? (
          <Link className="btn-primary" to={`${basePath}/new`}>Add Attendance</Link>
        ) : null}
      </div>

      <div className="filter-bar">
        <input
          placeholder="Department"
          value={filters.department ?? ''}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
        />
        <input
          type="number"
          placeholder="Month"
          min={1}
          max={12}
          value={filters.month ?? ''}
          onChange={(e) => setFilters({ ...filters, month: e.target.value ? Number(e.target.value) : '' })}
        />
        <input
          type="number"
          placeholder="Year"
          value={filters.year ?? ''}
          onChange={(e) => setFilters({ ...filters, year: e.target.value ? Number(e.target.value) : '' })}
        />
        <select
          value={filters.status ?? ''}
          onChange={(e) => setFilters({ ...filters, status: (e.target.value || '') as AttendanceStatus | '' })}
        >
          <option value="">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? (
        <p>Loading attendance...</p>
      ) : (
        <AttendanceTable
          records={records}
          basePath={basePath}
          showEmployee={showEmployee}
          canManage={canManage}
        />
      )}
    </section>
  );
}
