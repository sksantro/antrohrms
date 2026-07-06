import type { ReactNode } from 'react';

export interface SalesMetricItem {
  id: string;
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'purple' | 'cyan' | 'teal' | 'amber' | 'rose' | 'slate' | 'success' | 'danger';
}

interface SalesCommandCenterMetricsProps {
  title: string;
  subtitle?: string;
  metrics: SalesMetricItem[];
  variant?: 'highlight' | 'compact' | 'health';
}

function MetricCard({ metric, variant }: { metric: SalesMetricItem; variant: SalesCommandCenterMetricsProps['variant'] }) {
  return (
    <article className={['sales-cc-metric', `sales-cc-metric--${variant ?? 'compact'}`, metric.tone ? `is-${metric.tone}` : ''].filter(Boolean).join(' ')}>
      <span className="sales-cc-metric__label">{metric.label}</span>
      <strong className="sales-cc-metric__value">{metric.value}</strong>
      {metric.hint ? <span className="sales-cc-metric__hint">{metric.hint}</span> : null}
    </article>
  );
}

export function SalesCommandCenterMetrics({
  title,
  subtitle,
  metrics,
  variant = 'compact',
}: SalesCommandCenterMetricsProps) {
  return (
    <section className={`sales-cc-section sales-cc-section--${variant}`}>
      <div className="sales-cc-section__head">
        <div>
          <h2 className="sales-cc-section__title">{title}</h2>
          {subtitle ? <p className="sales-cc-section__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      <div className={`sales-cc-metric-grid sales-cc-metric-grid--${variant}`}>
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} variant={variant} />
        ))}
      </div>
    </section>
  );
}

export function SalesCcFilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="sales-cc-filter">
      <span className="sales-cc-filter__label">{label}</span>
      <div className="sales-cc-filter__control">{children}</div>
    </label>
  );
}
