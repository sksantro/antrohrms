import { useEffect, useState } from 'react';

import { salesService, type SalesKpiMetricResult } from '../../services/salesService';

function getStatusClass(status: string): string {
  if (status === 'Matched') {
    return 'is-matched';
  }
  if (status === 'Not Matched') {
    return 'is-not-matched';
  }
  return '';
}

interface SalesKpiCheckoutSummaryProps {
  onLoaded?: (metrics: SalesKpiMetricResult[]) => void;
}

export function SalesKpiCheckoutSummary({ onLoaded }: SalesKpiCheckoutSummaryProps) {
  const [metrics, setMetrics] = useState<SalesKpiMetricResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const summary = await salesService.getDailyKpiSummary();
        if (cancelled) {
          return;
        }
        setMetrics(summary.metrics);
        onLoaded?.(summary.metrics);
      } catch {
        if (!cancelled) {
          setError('Unable to load daily KPI summary.');
          setMetrics([]);
          onLoaded?.([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  if (loading) {
    return <p className="sales-checkout-kpi__loading muted">Loading today&apos;s KPI summary...</p>;
  }

  if (error) {
    return <p className="sales-checkout-kpi__error" role="alert">{error}</p>;
  }

  return (
    <div className="sales-checkout-kpi">
      <h4 className="sales-checkout-kpi__title">Today&apos;s KPI Summary</h4>
      <div className="sales-checkout-kpi__list">
        {metrics.map((metric) => (
          <div key={metric.id} className="sales-checkout-kpi__row">
            <span className="sales-checkout-kpi__label">{metric.label}</span>
            <span className="sales-checkout-kpi__counts">
              {metric.completed} / {metric.target}
            </span>
            <span className={['sales-kpi-card__status', getStatusClass(metric.status)].filter(Boolean).join(' ')}>
              {metric.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function hasUnmatchedKpi(metrics: SalesKpiMetricResult[]): boolean {
  return metrics.some((metric) => metric.status === 'Not Matched');
}
