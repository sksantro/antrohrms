import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  to?: string;
  accent?: boolean;
}

export function StatCard({ label, value, hint, to, accent = false }: StatCardProps) {
  const content = (
    <>
      <span className="ui-stat-label">{label}</span>
      <strong className="ui-stat-value">{value}</strong>
      {hint ? <span className="ui-stat-hint">{hint}</span> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`ui-stat-card ui-stat-card--link ${accent ? 'ui-stat-card--accent' : ''}`}>
        {content}
      </Link>
    );
  }

  return <article className={`ui-stat-card ${accent ? 'ui-stat-card--accent' : ''}`}>{content}</article>;
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="ui-stat-grid">{children}</div>;
}
