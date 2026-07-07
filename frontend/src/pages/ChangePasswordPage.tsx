import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../layouts/AuthLayout';
import { ApiError } from '../services/api';
import { getDashboardPath } from '../utils/rbac';

export function ChangePasswordPage() {
  const { user, isAuthenticated, isLoading, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isLoading && user && !user.must_change_password) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      navigate(getDashboardPath(user!.role));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to change password. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout subtitle="Set a new password to continue">
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="muted">
          For security, you must change your temporary password before accessing the dashboard.
        </p>

        <div className="auth-field">
          <label htmlFor="current_password" className="auth-label">
            Current Password <span className="auth-req">*</span>
          </label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden>
              <LockIcon />
            </span>
            <input
              id="current_password"
              type={showCurrentPassword ? 'text' : 'password'}
              className="auth-input auth-input--password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-toggle"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              aria-pressed={showCurrentPassword}
            >
              {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="new_password" className="auth-label">
            New Password <span className="auth-req">*</span>
          </label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden>
              <LockIcon />
            </span>
            <input
              id="new_password"
              type={showNewPassword ? 'text' : 'password'}
              className="auth-input auth-input--password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              className="auth-toggle"
              onClick={() => setShowNewPassword((prev) => !prev)}
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              aria-pressed={showNewPassword}
            >
              {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="confirm_password" className="auth-label">
            Confirm New Password <span className="auth-req">*</span>
          </label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden>
              <LockIcon />
            </span>
            <input
              id="confirm_password"
              type={showConfirmPassword ? 'text' : 'password'}
              className="auth-input auth-input--password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              className="auth-toggle"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" disabled={isSubmitting} className="auth-submit ui-btn ui-btn--primary">
          {isSubmitting ? 'Updating...' : 'Change Password'}
        </button>
      </form>
    </AuthLayout>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
