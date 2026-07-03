import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leaveService } from '../../services/leaveService';
import type { HalfDaySession, LeaveApplyPayload, LeaveType } from '../../types';
import { getLeavesBasePath } from '../../utils/rbac';

const leaveTypes: LeaveType[] = ['CASUAL', 'SICK', 'EMERGENCY', 'PLANNED', 'UNPAID'];
const sessions: HalfDaySession[] = ['FIRST_HALF', 'SECOND_HALF'];

export function ApplyLeavePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = user ? getLeavesBasePath(user.role) : '/employee/leaves';
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<LeaveApplyPayload>({
    leave_type: 'CASUAL',
    start_date: '',
    end_date: '',
    half_day: false,
    half_day_session: '',
    reason: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.end_date < form.start_date) {
      setError('End date cannot be before start date.');
      return;
    }
    if (form.half_day && !form.half_day_session) {
      setError('Please select a half-day session.');
      return;
    }

    setIsSubmitting(true);
    try {
      await leaveService.apply({
        ...form,
        half_day_session: form.half_day ? form.half_day_session : '',
      });
      navigate(basePath);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit leave request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="dashboard-card wide">
      <h2>Apply Leave</h2>
      <p className="muted">
        Working days exclude weekly offs and holidays. Insufficient balance becomes LOP days.
      </p>

      <form className="employee-form" onSubmit={(e) => void handleSubmit(e)}>
        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-grid">
          <label>
            Leave Type *
            <select
              required
              value={form.leave_type}
              onChange={(e) => setForm({ ...form, leave_type: e.target.value as LeaveType })}
            >
              {leaveTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Start Date *
            <input
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </label>
          <label>
            End Date *
            <input
              type="date"
              required
              value={form.end_date}
              min={form.start_date || undefined}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </label>
          <label>
            Half Day
            <select
              value={form.half_day ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, half_day: e.target.value === 'yes' })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          {form.half_day ? (
            <label>
              Half-Day Session *
              <select
                required
                value={form.half_day_session ?? ''}
                onChange={(e) =>
                  setForm({ ...form, half_day_session: e.target.value as HalfDaySession })
                }
              >
                <option value="">Select session</option>
                {sessions.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="full-width">
            Reason *
            <textarea
              rows={4}
              required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(basePath)}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </section>
  );
}
