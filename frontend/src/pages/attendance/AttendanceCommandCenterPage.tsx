import { useEffect, useMemo, useState } from 'react';

import { AttendanceTable } from '../../components/attendance/AttendanceTable';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard, KpiGrid } from '../../components/timeleave/KpiCard';
import {
  AbsentIcon,
  HoursIcon,
  InboxIcon,
  LateIcon,
  OnLeaveIcon,
  PlusIcon,
  PresentIcon,
  RecordsIcon,
} from '../../components/timeleave/commandIcons';
import { ButtonLink } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import { regularizationService } from '../../services/leaveService';
import type {
  Attendance,
  AttendanceFilters,
  AttendanceRegularization,
  AttendanceStatus,
  AttendanceSummary,
  WorkMode,
} from '../../types';
import { formatTime, formatWorkMode, getAttendanceBasePath } from '../../utils/rbac';

const statusOptions: AttendanceStatus[] = [
  'PRESENT',
  'ABSENT',
  'HALF_DAY',
  'LATE',
  'ON_LEAVE',
  'HOLIDAY',
];

const workModeOptions: WorkMode[] = ['OFFICE', 'WORK_FROM_HOME', 'CLIENT_LOCATION'];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function AttendanceCommandCenterPage() {
  const { user, can } = useAuth();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [regularizations, setRegularizations] = useState<AttendanceRegularization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [regMessage, setRegMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workMode, setWorkMode] = useState<WorkMode | ''>('');
  const [filters, setFilters] = useState<AttendanceFilters>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: '',
    department: '',
  });

  const basePath = user ? getAttendanceBasePath(user.role) : '/admin/attendance';
  const canManage = can('can_manage_attendance');
  const showEmployee = can('can_view_all_attendance') || can('can_view_team_attendance');
  const canActRegularization = can('can_approve_leaves');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [list, summaryData] = await Promise.all([
          attendanceService.list(filters),
          attendanceService.getSummary(filters),
        ]);
        if (!active) return;
        setRecords(list);
        setSummary(summaryData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load attendance.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [filters]);

  const loadRegularizations = async () => {
    try {
      const data = await regularizationService.list('PENDING');
      setRegularizations(data);
    } catch {
      setRegularizations([]);
    }
  };

  useEffect(() => {
    void loadRegularizations();
  }, []);

  const visibleRecords = useMemo(
    () => (workMode ? records.filter((record) => record.work_mode === workMode) : records),
    [records, workMode],
  );

  const handleApproveRegularization = async (id: number) => {
    setRegMessage(null);
    try {
      await regularizationService.approve(id);
      setRegMessage({ type: 'success', text: 'Regularization approved.' });
      await loadRegularizations();
    } catch (err) {
      setRegMessage({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to approve request.',
      });
    }
  };

  const handleRejectRegularization = async (id: number) => {
    const reason = window.prompt('Rejection reason:');
    if (!reason?.trim()) return;
    setRegMessage(null);
    try {
      await regularizationService.reject(id, reason.trim());
      setRegMessage({ type: 'success', text: 'Regularization rejected.' });
      await loadRegularizations();
    } catch (err) {
      setRegMessage({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to reject request.',
      });
    }
  };

  return (
    <div className="command-center attendance-cc">
      <section className="command-center__panel">
        <PageHeader
          title="Attendance"
          description="Track attendance, summaries, and regularization requests."
          actions={
            canManage ? (
              <ButtonLink to={`${basePath}/new`} className="cc-add-button">
                <PlusIcon />
                Add Attendance
              </ButtonLink>
            ) : undefined
          }
        />

        <div className="cc-filters">
          <label className="cc-filter">
            <span className="cc-filter__label">Department</span>
            <input
              className="cc-filter__control"
              placeholder="All departments"
              value={filters.department ?? ''}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            />
          </label>
          <label className="cc-filter">
            <span className="cc-filter__label">Month</span>
            <select
              className="cc-filter__control"
              value={filters.month ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, month: e.target.value ? Number(e.target.value) : '' })
              }
            >
              <option value="">All</option>
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label className="cc-filter">
            <span className="cc-filter__label">Year</span>
            <input
              className="cc-filter__control"
              type="number"
              placeholder="Year"
              value={filters.year ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, year: e.target.value ? Number(e.target.value) : '' })
              }
            />
          </label>
          <label className="cc-filter">
            <span className="cc-filter__label">Status</span>
            <select
              className="cc-filter__control"
              value={filters.status ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, status: (e.target.value || '') as AttendanceStatus | '' })
              }
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="cc-filter">
            <span className="cc-filter__label">Work Mode</span>
            <select
              className="cc-filter__control"
              value={workMode}
              onChange={(e) => setWorkMode((e.target.value || '') as WorkMode | '')}
            >
              <option value="">All modes</option>
              {workModeOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {formatWorkMode(mode)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <KpiGrid>
        <KpiCard label="Total Records" value={summary?.total_records ?? '—'} tone="purple" icon={<RecordsIcon />} />
        <KpiCard label="Present" value={summary?.present ?? '—'} tone="teal" icon={<PresentIcon />} />
        <KpiCard label="Absent" value={summary?.absent ?? '—'} tone="rose" icon={<AbsentIcon />} />
        <KpiCard label="Late" value={summary?.late ?? '—'} tone="amber" icon={<LateIcon />} />
        <KpiCard label="On Leave" value={summary?.on_leave ?? '—'} tone="cyan" icon={<OnLeaveIcon />} />
        <KpiCard
          label="Total Work Hours"
          value={summary?.total_work_hours ?? '—'}
          tone="slate"
          icon={<HoursIcon />}
        />
      </KpiGrid>

      <div className="cc-split">
        <section className="command-center__panel">
          <div className="cc-panel__head">
            <div>
              <h3 className="cc-panel__title">Attendance Records</h3>
              <p className="cc-panel__subtitle">Filtered attendance entries with status and work hours.</p>
            </div>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {isLoading ? (
            <p className="muted cc-loading">Loading attendance...</p>
          ) : (
            <AttendanceTable
              records={visibleRecords}
              basePath={basePath}
              showEmployee={showEmployee}
              canManage={canManage}
            />
          )}
        </section>

        <section className="command-center__panel">
          <div className="cc-panel__head">
            <div>
              <h3 className="cc-panel__title">Regularization Requests</h3>
              <p className="cc-panel__subtitle">Pending correction requests awaiting review.</p>
            </div>
            <span className="cc-count-pill">{regularizations.length}</span>
          </div>

          {regMessage ? (
            <p className={regMessage.type === 'success' ? 'form-success' : 'form-error'}>
              {regMessage.text}
            </p>
          ) : null}

          {regularizations.length === 0 ? (
            <div className="cc-empty">
              <span className="cc-empty__icon">
                <InboxIcon />
              </span>
              <p className="cc-empty__title">No pending requests</p>
              <p className="cc-empty__text">Regularization requests will appear here for review.</p>
            </div>
          ) : (
            <div className="cc-queue">
              {regularizations.map((request) => (
                <article key={request.id} className="cc-queue-item">
                  <div className="cc-queue-item__top">
                    <span className="cc-queue-item__name">{request.employee_name}</span>
                    <span className="cc-queue-item__date">{request.date}</span>
                  </div>
                  <div className="cc-queue-item__meta">
                    <span>In: {formatTime(request.requested_check_in)}</span>
                    <span>Out: {formatTime(request.requested_check_out)}</span>
                  </div>
                  {request.reason ? <p className="cc-queue-item__reason">{request.reason}</p> : null}
                  {canActRegularization ? (
                    <div className="cc-queue-item__actions">
                      <button
                        type="button"
                        className="cc-btn cc-btn--approve"
                        onClick={() => void handleApproveRegularization(request.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="cc-btn cc-btn--reject"
                        onClick={() => void handleRejectRegularization(request.id)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
