import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { regularizationService } from '../../services/leaveService';
import type { AttendanceRegularization } from '../../types';
import { getLeavesBasePath } from '../../utils/rbac';

export function RegularizationRequestPage() {
  const { user } = useAuth();
  const basePath = user ? getLeavesBasePath(user.role) : '/employee/leaves';
  const [records, setRecords] = useState<AttendanceRegularization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: '',
    requested_check_in: '',
    requested_check_out: '',
    reason: '',
  });

  const load = async () => {
    try {
      const data = await regularizationService.getMy();
      setRecords(data);
    } catch {
      setRecords([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await regularizationService.apply({
        date: form.date,
        requested_check_in: form.requested_check_in || null,
        requested_check_out: form.requested_check_out || null,
        reason: form.reason,
      });
      setSuccess('Regularization request submitted.');
      setForm({ date: '', requested_check_in: '', requested_check_out: '', reason: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>Attendance Regularization</h2>
          <p className="muted">Request correction within 2 days. Beyond that requires HR/Admin.</p>
        </div>
        <Link to={basePath}>My Leaves</Link>
      </div>

      <form className="employee-form" onSubmit={(e) => void handleSubmit(e)}>
        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}
        <div className="form-grid">
          <label>Date *<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Check In<input type="time" value={form.requested_check_in} onChange={(e) => setForm({ ...form, requested_check_in: e.target.value })} /></label>
          <label>Check Out<input type="time" value={form.requested_check_out} onChange={(e) => setForm({ ...form, requested_check_out: e.target.value })} /></label>
          <label className="full-width">Reason *<textarea rows={3} required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit'}</button>
        </div>
      </form>

      <h3>My Requests</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.requested_check_in ?? '-'}</td>
                <td>{r.requested_check_out ?? '-'}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RegularizationManagementPage() {
  const { can } = useAuth();
  const [records, setRecords] = useState<AttendanceRegularization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canAct = can('can_approve_leaves');

  const load = async () => {
    try {
      const data = await regularizationService.list('PENDING');
      setRecords(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load requests.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await regularizationService.approve(id);
      setSuccess('Regularization approved.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to approve.');
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt('Rejection reason:');
    if (!reason?.trim()) return;
    try {
      await regularizationService.reject(id, reason.trim());
      setSuccess('Regularization rejected.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reject.');
    }
  };

  return (
    <section className="dashboard-card wide">
      <h2>Attendance Regularization Management</h2>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Employee</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Reason</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.employee_name}</td>
                <td>{r.date}</td>
                <td>{r.requested_check_in ?? '-'}</td>
                <td>{r.requested_check_out ?? '-'}</td>
                <td>{r.reason}</td>
                <td className="table-actions">
                  {canAct ? <button type="button" onClick={() => void handleApprove(r.id)}>Approve</button> : null}
                  {canAct ? <button type="button" className="btn-secondary" onClick={() => void handleReject(r.id)}>Reject</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
