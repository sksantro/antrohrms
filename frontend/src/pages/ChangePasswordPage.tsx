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

        <label htmlFor="current_password">Current Password</label>
        <input
          id="current_password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />

        <label htmlFor="new_password">New Password</label>
        <input
          id="new_password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />

        <label htmlFor="confirm_password">Confirm New Password</label>
        <input
          id="confirm_password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Change Password'}
        </button>
      </form>
    </AuthLayout>
  );
}
