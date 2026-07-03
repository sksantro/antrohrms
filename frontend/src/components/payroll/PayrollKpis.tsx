import type { ReactNode } from 'react';

export type PayrollKpiTone = 'purple' | 'cyan' | 'amber' | 'teal' | 'rose' | 'slate';

interface PayrollKpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: PayrollKpiTone;
}

export function PayrollKpiCard({ label, value, hint, icon, tone = 'purple' }: PayrollKpiCardProps) {
  return (
    <article className="payroll-kpi">
      <span className={`payroll-kpi__icon payroll-kpi__icon--${tone}`}>{icon}</span>
      <span className="payroll-kpi__content">
        <span className="payroll-kpi__label">{label}</span>
        <strong className="payroll-kpi__value">{value}</strong>
        {hint ? <span className="payroll-kpi__hint">{hint}</span> : null}
      </span>
    </article>
  );
}

export function PayrollKpiGrid({ children }: { children: ReactNode }) {
  return <div className="payroll-kpi-grid">{children}</div>;
}
