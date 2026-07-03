import { useState } from 'react';

import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import type { Attendance, WorkMode } from '../../types';
import { formatAttendanceStatus, formatTime, formatWorkMode } from '../../utils/rbac';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';

interface CheckInOutPanelProps {
  today: Attendance | null;
  onUpdated: () => void;
  compact?: boolean;
}

export function CheckInOutPanel({ today, onUpdated, compact = false }: CheckInOutPanelProps) {
  const [workMode, setWorkMode] = useState<WorkMode>('OFFICE');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCheckIn = !today;
  const canCheckOut = Boolean(today?.check_in_time && !today?.check_out_time);

  const handleCheckIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await attendanceService.checkIn(workMode);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to check in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await attendanceService.checkOut();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to check out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={compact ? 'check-panel compact' : 'check-panel'}>
      <h3>Today&apos;s Attendance</h3>

      {today ? (
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <span className="detail-value">
              <AttendanceStatusBadge status={today.status} />
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Work Mode</span>
            <span className="detail-value">{formatWorkMode(today.work_mode)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Check In</span>
            <span className="detail-value">{formatTime(today.check_in_time)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Check Out</span>
            <span className="detail-value">{formatTime(today.check_out_time)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Hours</span>
            <span className="detail-value">{today.total_work_hours}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Late Minutes</span>
            <span className="detail-value">{today.late_minutes}</span>
          </div>
        </div>
      ) : (
        <p className="muted">You have not checked in today.</p>
      )}

      {canCheckIn ? (
        <div className="check-actions">
          <label>
            Work Mode
            <select value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode)}>
              <option value="OFFICE">Office</option>
              <option value="WORK_FROM_HOME">Work From Home</option>
              <option value="CLIENT_LOCATION">Client Location</option>
            </select>
          </label>
          <button type="button" disabled={isSubmitting} onClick={() => void handleCheckIn()}>
            {isSubmitting ? 'Checking in...' : 'Check In'}
          </button>
        </div>
      ) : null}

      {canCheckOut ? (
        <div className="check-actions">
          <button type="button" className="btn-primary" disabled={isSubmitting} onClick={() => void handleCheckOut()}>
            {isSubmitting ? 'Checking out...' : 'Check Out'}
          </button>
        </div>
      ) : null}

      {today?.check_out_time ? (
        <p className="form-success">Attendance completed for today ({formatAttendanceStatus(today.status)}).</p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
