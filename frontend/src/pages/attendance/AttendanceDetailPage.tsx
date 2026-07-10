import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { AttendanceStatusBadge } from '../../components/attendance/AttendanceStatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import type { Attendance, AttendanceStatus } from '../../types';
import {
  formatAttendanceStatus,
  formatTime,
  formatWorkMode,
  getAttendanceBasePath,
} from '../../utils/rbac';

export function AttendanceDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user, can } = useAuth();
  const [record, setRecord] = useState<Attendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isHrAttendanceRoute = location.pathname.startsWith('/hr/attendance');
  const basePath = isHrAttendanceRoute
    ? '/hr/attendance'
    : user
      ? getAttendanceBasePath(user.role, user.department)
      : '/admin/attendance';
  const canManage = can('can_manage_attendance') && !isHrAttendanceRoute;

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await attendanceService.get(Number(id));
        setRecord(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load attendance.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id]);

  if (isLoading) {
    return (
      <section className="payroll-card">
        <p className="muted">Loading attendance...</p>
      </section>
    );
  }

  if (error || !record) {
    return (
      <section className="payroll-card">
        <p className="form-error">{error ?? 'Record not found.'}</p>
        <Link to={basePath}>Back</Link>
      </section>
    );
  }

  return (
    <section className="payroll-card">
      <div className="page-toolbar">
        <div>
          <h2>Attendance Details</h2>
          <p className="muted">
            {record.employee_name} — {record.date}
          </p>
        </div>
        <div className="toolbar-actions">
          <Link to={basePath}>Back</Link>
          {canManage ? <Link to={`${basePath}/${record.id}/edit`}>Edit</Link> : null}
        </div>
      </div>

      <div className="detail-grid">
        <DetailItem label="Employee Code" value={record.employee_code} />
        <DetailItem label="Department" value={record.department} />
        <DetailItem label="Date" value={record.date} />
        <DetailItem label="Check In" value={formatTime(record.check_in_time)} />
        <DetailItem label="Check Out" value={formatTime(record.check_out_time)} />
        <DetailItem label="Work Mode" value={formatWorkMode(record.work_mode)} />
        <DetailItem
          label="Status"
          value={
            <AttendanceStatusBadge
              status={(record.display_status || record.status) as AttendanceStatus}
            />
          }
        />
        <DetailItem
          label="Late Status"
          value={record.late_status || (record.late_minutes > 0 ? 'Late' : '—')}
        />
        <DetailItem
          label="Regularization Status"
          value={
            record.regularization_status
              ? formatAttendanceStatus(record.regularization_status)
              : '—'
          }
        />
        <DetailItem label="Total Hours" value={record.total_work_hours} />
        <DetailItem label="Late Minutes" value={String(record.late_minutes)} />
        <DetailItem label="Remarks" value={record.remarks || '-'} fullWidth />
      </div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'detail-item full-width' : 'detail-item'}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
