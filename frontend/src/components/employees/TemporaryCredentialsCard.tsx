import { useState } from 'react';

import { copyToClipboard } from '../../utils/clipboard';

interface TemporaryCredentialsCardProps {
  email: string;
  temporaryPassword: string;
  employeeCode: string;
  onContinue: () => void;
}

export function TemporaryCredentialsCard({
  email,
  temporaryPassword,
  employeeCode,
  onContinue,
}: TemporaryCredentialsCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (field: string, value: string) => {
    const success = await copyToClipboard(value);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="credentials-card">
      <h3>Employee account created</h3>
      <p className="muted">
        Share these login details with the employee securely. The temporary password is shown
        only once and is not stored in plain text.
      </p>

      <div className="credential-row">
        <div>
          <span className="detail-label">Employee Code</span>
          <strong>{employeeCode}</strong>
        </div>
      </div>

      <div className="credential-row">
        <div>
          <span className="detail-label">Login Email</span>
          <strong>{email}</strong>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void handleCopy('email', email)}>
          {copiedField === 'email' ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="credential-row">
        <div>
          <span className="detail-label">Temporary Password</span>
          <strong className="mono">{temporaryPassword}</strong>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void handleCopy('password', temporaryPassword)}
        >
          {copiedField === 'password' ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="credentials-warning">
        The employee must change this password on first login.
      </p>

      <button type="button" className="btn-primary" onClick={onContinue}>
        Done
      </button>
    </div>
  );
}
