import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  to?: string;
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, to, accent = false, className = '' }: StatCardProps) {
  const content = (
    <>
      <span className="ui-stat-label">{label}</span>
      <strong className="ui-stat-value">{value}</strong>
      {hint ? <span className="ui-stat-hint">{hint}</span> : null}
    </>
  );

  const cardClassName = ['ui-stat-card', className, accent ? 'ui-stat-card--accent' : '']
    .filter(Boolean)
    .join(' ');

  if (to) {
    return (
      <Link to={to} className={`${cardClassName} ui-stat-card--link`}>
        {content}
      </Link>
    );
  }

  return <article className={cardClassName}>{content}</article>;
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="ui-stat-grid">{children}</div>;
}
