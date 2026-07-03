import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import type { AttendanceFilters, AttendanceStatus, AttendanceSummary } from '../../types';
import { getAttendanceBasePath } from '../../utils/rbac';

const statusOptions: AttendanceStatus[] = [
  'PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY',
];

export function AttendanceSummaryPage() {
  const { user, can } = useAuth();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AttendanceFilters>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: '',
    department: '',
  });

  const basePath = user ? getAttendanceBasePath(user.role) : '/admin/attendance';
  const showListLink = can('can_view_all_attendance') || can('can_view_team_attendance');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await attendanceService.getSummary(filters);
        setSummary(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load summary.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [filters]);

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>Attendance Summary</h2>
          <p className="muted">Aggregated attendance metrics with filters.</p>
        </div>
        {showListLink ? <Link to={basePath}>View List</Link> : null}
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
        <p>Loading summary...</p>
      ) : summary ? (
        <div className="summary-grid">
          <SummaryCard label="Total Records" value={summary.total_records} />
          <SummaryCard label="Present" value={summary.present} />
          <SummaryCard label="Absent" value={summary.absent} />
          <SummaryCard label="Late" value={summary.late} />
          <SummaryCard label="Half Day" value={summary.half_day} />
          <SummaryCard label="On Leave" value={summary.on_leave} />
          <SummaryCard label="Holiday" value={summary.holiday} />
          <SummaryCard label="Total Work Hours" value={summary.total_work_hours} />
          <SummaryCard label="Total Late Minutes" value={summary.total_late_minutes} />
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="summary-card">
      <span className="detail-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
