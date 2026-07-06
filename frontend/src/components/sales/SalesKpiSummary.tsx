import { useEffect, useState } from 'react';

import { salesService, type SalesKpiMetricResult } from '../../services/salesService';
import {
  getKpiDisplayStatus,
  getKpiPendingCount,
  getKpiStatusClass,
} from './kpiDisplayStatus';
import { SALES_KPI_PERIODS, type SalesKpiPeriod } from './salesKpiTargets';

function formatPeriodRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const formatter = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (start === end) {
    return formatter.format(startDate);
  }
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

export function SalesKpiSummary() {
  const [period, setPeriod] = useState<SalesKpiPeriod>('daily');
  const [metricsById, setMetricsById] = useState<Record<string, SalesKpiMetricResult>>({});
  const [dailyReportSubmitted, setDailyReportSubmitted] = useState(false);
  const [periodRange, setPeriodRange] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activePeriod = SALES_KPI_PERIODS.find((item) => item.id === period) ?? SALES_KPI_PERIODS[0];

  useEffect(() => {
    let cancelled = false;

    async function loadKpi() {
      setLoading(true);
      setError(null);
      try {
        const summary = await salesService.getKpiSummary(period);
        if (cancelled) {
          return;
        }
        setMetricsById(Object.fromEntries(summary.metrics.map((metric) => [metric.id, metric])));
        setDailyReportSubmitted(summary.daily_report_submitted ?? false);
        setPeriodRange(formatPeriodRange(summary.period_start, summary.period_end));
      } catch {
        if (!cancelled) {
          setError(`Unable to load ${activePeriod.label.toLowerCase()} KPI summary.`);
          setMetricsById({});
          setDailyReportSubmitted(false);
          setPeriodRange(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadKpi();

    return () => {
      cancelled = true;
    };
  }, [period, activePeriod.label]);

  return (
    <div className="sales-kpi">
      <div className="sales-kpi__tabs" role="tablist" aria-label="KPI period">
        {SALES_KPI_PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            className={['sales-kpi__tab', period === item.id ? 'is-active' : ''].filter(Boolean).join(' ')}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {periodRange ? (
        <p className="sales-kpi__range muted">{periodRange}</p>
      ) : null}

      {error ? (
        <p className="sales-kpi__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sales-kpi__grid" role="tabpanel" aria-label={`${activePeriod.label} KPI targets`}>
        {activePeriod.metrics.map((metric) => {
          const liveMetric = metricsById[metric.id];
          const completed = liveMetric?.completed ?? 0;
          const targetMin = liveMetric?.target_min ?? (Number.parseInt(metric.target, 10) || 0);
          const targetDisplay = liveMetric?.target ?? metric.target;
          const pending =
            metric.kind === 'report'
              ? null
              : !loading
                ? getKpiPendingCount(completed, targetMin)
                : null;
          const status =
            metric.kind === 'report'
              ? loading
                ? 'Loading'
                : dailyReportSubmitted
                  ? 'Matched'
                  : 'Not Matched'
              : getKpiDisplayStatus(completed, targetMin, loading);

          return (
            <article key={metric.id} className="sales-kpi-card">
              <div className="sales-kpi-card__top">
                <h4 className="sales-kpi-card__label">{metric.label}</h4>
                <span className={['sales-kpi-card__status', getKpiStatusClass(status)].filter(Boolean).join(' ')}>
                  {status}
                </span>
              </div>
              <div className="sales-kpi-card__values">
                <div className="sales-kpi-card__metric">
                  <span className="sales-kpi-card__metric-label">Target</span>
                  <span className="sales-kpi-card__metric-value">{targetDisplay}</span>
                </div>
                {metric.kind === 'report' ? (
                  <div className="sales-kpi-card__metric">
                    <span className="sales-kpi-card__metric-label">Submitted</span>
                    <span
                      className={[
                        'sales-kpi-card__metric-value',
                        !loading && !dailyReportSubmitted ? 'sales-kpi-card__metric-value--muted' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {loading ? '—' : dailyReportSubmitted ? 'Yes' : 'No'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="sales-kpi-card__metric">
                      <span className="sales-kpi-card__metric-label">Completed</span>
                      <span className="sales-kpi-card__metric-value">
                        {loading ? '—' : completed}
                      </span>
                    </div>
                    <div className="sales-kpi-card__metric">
                      <span className="sales-kpi-card__metric-label">Pending</span>
                      <span className="sales-kpi-card__metric-value">
                        {loading ? '—' : pending}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
