import type { ReactNode } from 'react';

export type KpiTone = 'purple' | 'cyan' | 'amber' | 'teal' | 'rose' | 'slate';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: KpiTone;
}

export function KpiCard({ label, value, icon, tone = 'purple' }: KpiCardProps) {
  return (
    <article className="cc-kpi">
      <span className={`cc-kpi__icon cc-kpi__icon--${tone}`}>{icon}</span>
      <span className="cc-kpi__content">
        <strong className="cc-kpi__value">{value}</strong>
        <span className="cc-kpi__label">{label}</span>
      </span>
    </article>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="cc-kpi-grid">{children}</div>;
}
