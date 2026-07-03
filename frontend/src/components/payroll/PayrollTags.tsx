import type { ReactNode } from 'react';

import { LockDotIcon } from './payrollIcons';

export function ConfidentialTag() {
  return (
    <span className="payroll-tag payroll-tag--confidential">
      <LockDotIcon />
      Confidential
    </span>
  );
}

export function SensitiveTag() {
  return (
    <span className="payroll-tag payroll-tag--sensitive">
      <LockDotIcon />
      Sensitive Data
    </span>
  );
}

export function ProtectedValue({ children }: { children: ReactNode }) {
  return (
    <span className="payroll-protected">
      <LockDotIcon />
      <span className="payroll-protected__value">{children}</span>
    </span>
  );
}
