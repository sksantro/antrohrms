import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import { employeeService } from '../../services/employeeService';
import type {
  AttendanceCreatePayload,
  AttendanceStatus,
  AttendanceUpdatePayload,
  Employee,
  WorkMode,
} from '../../types';
import { formatAttendanceStatus, getAttendanceBasePath } from '../../utils/rbac';

const workModes: WorkMode[] = ['OFFICE', 'WORK_FROM_HOME', 'CLIENT_LOCATION'];
const statuses: AttendanceStatus[] = [
  'PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY',
];

export function AttendanceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const basePath = user ? getAttendanceBasePath(user.role, user.department) : '/admin/attendance';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<AttendanceCreatePayload>({
    employee: 0,
    date: new Date().toISOString().slice(0, 10),
    check_in_time: '09:00',
    check_out_time: '18:00',
    work_mode: 'OFFICE',
    status: 'PRESENT',
    remarks: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const employeeList = await employeeService.list();
        setEmployees(employeeList);
        if (employeeList.length && !form.employee) {
          setForm((prev) => ({ ...prev, employee: employeeList[0].id }));
        }
        if (isEdit && id) {
          const record = await attendanceService.get(Number(id));
          setForm({
            employee: record.employee,
            date: record.date,
            check_in_time: record.check_in_time ?? '',
            check_out_time: record.check_out_time ?? '',
            work_mode: record.work_mode,
            status: record.status,
            remarks: record.remarks,
          });
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load data.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const payload: AttendanceUpdatePayload = {
          check_in_time: form.check_in_time || null,
          check_out_time: form.check_out_time || null,
          work_mode: form.work_mode,
          status: form.status,
          remarks: form.remarks,
        };
        await attendanceService.update(Number(id), payload);
        navigate(`${basePath}/${id}`);
      } else {
        await attendanceService.create(form);
        navigate(basePath);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <section className="dashboard-card wide"><p>Loading...</p></section>;
  }

  return (
    <section className="dashboard-card wide">
      <h2>{isEdit ? 'Edit Attendance' : 'Add Attendance'}</h2>
      <p className="muted">HR can manually create or update attendance records.</p>

      <form className="employee-form" onSubmit={(e) => void handleSubmit(e)}>
        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-grid">
          {!isEdit ? (
            <label>
              Employee *
              <select
                required
                value={form.employee || ''}
                onChange={(e) => setForm({ ...form, employee: Number(e.target.value) })}
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} - {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {!isEdit ? (
            <label>
              Date *
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
          ) : null}
          <label>
            Check In
            <input
              type="time"
              value={form.check_in_time ?? ''}
              onChange={(e) => setForm({ ...form, check_in_time: e.target.value })}
            />
          </label>
          <label>
            Check Out
            <input
              type="time"
              value={form.check_out_time ?? ''}
              onChange={(e) => setForm({ ...form, check_out_time: e.target.value })}
            />
          </label>
          <label>
            Work Mode
            <select
              value={form.work_mode}
              onChange={(e) => setForm({ ...form, work_mode: e.target.value as WorkMode })}
            >
              {workModes.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as AttendanceStatus })}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{formatAttendanceStatus(s)}</option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Remarks
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(basePath)}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </section>
  );
}
