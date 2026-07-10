import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AttendanceStatusBadge } from '../../components/attendance/AttendanceStatusBadge';
import { PageHeader } from '../../components/PageHeader';
import { DatePicker, Select, Table } from '../../components/ui';
import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import type { Attendance, AttendanceFilters, AttendanceStatus, AttendanceSummary } from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { formatEmployeeDate } from '../../utils/employeeFilters';
import { formatAttendanceStatus, formatTime } from '../../utils/rbac';

const STATUS_OPTIONS: Array<{ value: AttendanceStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'ON_LEAVE', label: 'Leave' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'MISSING_PUNCH', label: 'Missing Punch' },
];

const REG_STATUS_OPTIONS = [
  { value: '', label: 'All regularization statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function displayStatus(record: Attendance): string {
  return record.display_status || record.status;
}

export function HRAttendanceViewPage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [todaySummary, setTodaySummary] = useState<AttendanceSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AttendanceFilters>({
    date: todayISO(),
    department: '',
    employee: '',
    status: '',
    search: '',
    regularization_status: '',
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const now = new Date();
        const [list, todayData, monthData] = await Promise.all([
          attendanceService.list(filters),
          attendanceService.getSummary({ date: todayISO() }).catch(() => null),
          attendanceService
            .getSummary({ month: now.getMonth() + 1, year: now.getFullYear() })
            .catch(() => null),
        ]);
        if (!active) return;
        setRecords(list);
        setTodaySummary(todayData);
        setMonthSummary(monthData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load attendance records.');
        setRecords([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [filters]);

  const employees = useMemo(() => {
    const map = new Map<number, string>();
    records.forEach((record) => {
      map.set(record.employee, `${record.employee_name} (${record.employee_code})`);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [records]);

  const clearFilters = () => {
    setFilters({
      date: todayISO(),
      department: '',
      employee: '',
      status: '',
      search: '',
      regularization_status: '',
    });
  };

  return (
    <div className="hr-attendance-page">
      <section className="payroll-card">
        <PageHeader
          title="Attendance View"
          description="Monitor employee attendance. Regularization approval remains with Super Admin only."
        />

        {error ? <p className="form-error">{error}</p> : null}

        <div className="hr-attendance-kpis">
          <article className="hr-attendance-kpi">
            <span>Today Present</span>
            <strong>{todaySummary?.present ?? '—'}</strong>
          </article>
          <article className="hr-attendance-kpi">
            <span>Today Absent</span>
            <strong>{todaySummary?.absent ?? '—'}</strong>
          </article>
          <article className="hr-attendance-kpi">
            <span>Late Today</span>
            <strong>{todaySummary?.late ?? '—'}</strong>
          </article>
          <article className="hr-attendance-kpi">
            <span>Missing Punch</span>
            <strong>{todaySummary?.missing_punch ?? '—'}</strong>
          </article>
          <article className="hr-attendance-kpi">
            <span>On Leave</span>
            <strong>{todaySummary?.on_leave ?? '—'}</strong>
          </article>
        </div>

        {monthSummary ? (
          <p className="muted hr-attendance-month-note">
            Monthly snapshot ({new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}):{' '}
            {monthSummary.present} present · {monthSummary.absent} absent · {monthSummary.late} late ·{' '}
            {monthSummary.on_leave} on leave
          </p>
        ) : null}

        <div className="offer-letter-filters">
          <div className="offer-letter-filters__top">
            <label className="offer-letter-filters__search">
              <input
                type="search"
                className="offer-letter-filters__search-input"
                placeholder="Search name, email, employee code, department"
                value={filters.search ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                aria-label="Search attendance records"
              />
            </label>
            <button type="button" className="offer-letter-filters__reset" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
          <div className="offer-letter-filters__grid">
            <DatePicker
              id="hr_attendance_date"
              label="Date"
              value={filters.date ?? ''}
              onChange={(value) => setFilters((current) => ({ ...current, date: value }))}
            />
            <Select
              id="hr_attendance_department"
              label="Department"
              value={filters.department ?? ''}
              onChange={(event) =>
                setFilters((current) => ({ ...current, department: event.target.value }))
              }
            >
              <option value="">All departments</option>
              {EMPLOYEE_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </Select>
            <Select
              id="hr_attendance_employee"
              label="Employee"
              value={filters.employee ? String(filters.employee) : ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  employee: event.target.value ? Number(event.target.value) : '',
                }))
              }
            >
              <option value="">All employees</option>
              {employees.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              id="hr_attendance_status"
              label="Attendance Status"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: (event.target.value || '') as AttendanceStatus | '',
                }))
              }
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              id="hr_attendance_reg_status"
              label="Regularization Status"
              value={filters.regularization_status ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  regularization_status: (event.target.value || '') as
                    | 'PENDING'
                    | 'APPROVED'
                    | 'REJECTED'
                    | '',
                }))
              }
            >
              {REG_STATUS_OPTIONS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="hr-attendance-loading">
            <span className="employees-page__loading-spinner" aria-hidden />
            <p>Loading attendance records...</p>
          </div>
        ) : (
          <Table className="hr-attendance-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Employee Code</th>
                <th>Department</th>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Late Status</th>
                <th>Regularization Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="hr-attendance-empty">
                      <strong>No attendance records found</strong>
                      <span>Try adjusting date, department, or search filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.employee_name}</td>
                    <td>{record.employee_code}</td>
                    <td>{record.department || '—'}</td>
                    <td>{formatEmployeeDate(record.date)}</td>
                    <td>{formatTime(record.check_in_time)}</td>
                    <td>{formatTime(record.check_out_time)}</td>
                    <td>{record.total_work_hours || '0.00'}</td>
                    <td>
                      <AttendanceStatusBadge status={displayStatus(record) as AttendanceStatus} />
                    </td>
                    <td>{record.late_status || (record.late_minutes > 0 ? 'Late' : '—')}</td>
                    <td>
                      {record.regularization_status
                        ? formatAttendanceStatus(record.regularization_status)
                        : '—'}
                    </td>
                    <td>
                      <Link to={`/hr/attendance/${record.id}`} className="payroll-action">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
