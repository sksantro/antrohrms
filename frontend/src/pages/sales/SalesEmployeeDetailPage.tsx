import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { Table } from '../../components/ui';
import { ApiError } from '../../services/api';
import {
  salesService,
  type SalesCommandCenterPeriod,
  type SalesEmployeeDetailResponse,
} from '../../services/salesService';
import {
  getKpiDisplayStatus,
  getKpiPendingCount,
  getKpiStatusClass,
} from '../../components/sales/kpiDisplayStatus';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatActivityType(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function SalesEmployeeDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const period = (searchParams.get('period') as SalesCommandCenterPeriod) || 'daily';

  const [detail, setDetail] = useState<SalesEmployeeDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await salesService.getCommandCenterEmployeeDetail(Number(userId), { date, period });
        if (!active) return;
        setDetail(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load employee sales detail.');
        setDetail(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [userId, date, period]);

  return (
    <div className="sales-cc">
      <header className="sales-cc-hero sales-cc-hero--detail">
        <div className="sales-cc-hero__glow" aria-hidden />
        <div className="sales-cc-hero__content">
          <span className="sales-cc-hero__eyebrow">Employee drill-down</span>
          <h1 className="sales-cc-hero__title">{detail?.employee.full_name ?? 'Sales Employee Detail'}</h1>
          <p className="sales-cc-hero__description">
            KPI progress, owned leads, activities, checkout report, and not-counted items.
          </p>
        </div>
        <div className="sales-cc-hero__aside">
          <Link className="sales-cc-btn sales-cc-btn--ghost" to={`/admin/sales?date=${date}&period=${period}`}>
            Back to Command Center
          </Link>
        </div>
      </header>

      {error ? <p className="sales-cc-error">{error}</p> : null}
      {isLoading ? <div className="sales-cc-empty">Loading employee detail...</div> : null}

      {detail ? (
        <>
          <section className="sales-cc-section">
            <div className="sales-cc-section__head">
              <div>
                <h2 className="sales-cc-section__title">KPI summary</h2>
                <p className="sales-cc-section__subtitle">
                  {detail.period_start} to {detail.period_end} · Checkout: {detail.last_checkout_status.status}
                </p>
              </div>
            </div>
            <div className="sales-kpi__grid">
              {detail.kpi_summary.metrics.map((metric) => {
                const status = getKpiDisplayStatus(metric.completed, metric.target_min);
                const pending = getKpiPendingCount(metric.completed, metric.target_min);
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
                        <span className="sales-kpi-card__metric-value">{metric.target}</span>
                      </div>
                      <div className="sales-kpi-card__metric">
                        <span className="sales-kpi-card__metric-label">Completed</span>
                        <span className="sales-kpi-card__metric-value">{metric.completed}</span>
                      </div>
                      <div className="sales-kpi-card__metric">
                        <span className="sales-kpi-card__metric-label">Pending</span>
                        <span className="sales-kpi-card__metric-value">{pending}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="sales-cc-split">
            <section className="sales-cc-section">
              <h2 className="sales-cc-section__title">Leads owned</h2>
              <div className="ui-table-wrap">
                <Table className="ui-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Next Follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.leads_owned.length === 0 ? (
                      <tr><td colSpan={4} className="muted">No leads owned.</td></tr>
                    ) : (
                      detail.leads_owned.map((lead) => (
                        <tr key={lead.id}>
                          <td>
                            <Link className="payroll-back" to={`/admin/leads/${lead.id}`}>
                              {lead.company_name}
                            </Link>
                          </td>
                          <td>{lead.current_status.replaceAll('_', ' ')}</td>
                          <td>{lead.priority}</td>
                          <td>{lead.next_follow_up_date || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </section>

            <section className="sales-cc-section">
              <h2 className="sales-cc-section__title">Follow-ups pending</h2>
              <div className="ui-table-wrap">
                <Table className="ui-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.follow_ups_pending.length === 0 ? (
                      <tr><td colSpan={3} className="muted">No pending follow-ups.</td></tr>
                    ) : (
                      detail.follow_ups_pending.map((lead) => (
                        <tr key={lead.id}>
                          <td>{lead.company_name}</td>
                          <td>{lead.current_status.replaceAll('_', ' ')}</td>
                          <td>{lead.next_follow_up_date || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </section>
          </div>

          <section className="sales-cc-section">
            <h2 className="sales-cc-section__title">Activities done</h2>
            <div className="ui-table-wrap">
              <Table className="ui-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Lead</th>
                    <th>Counted</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.activities_done.length === 0 ? (
                    <tr><td colSpan={4} className="muted">No activities in selected period.</td></tr>
                  ) : (
                    detail.activities_done.map((activity) => (
                      <tr key={activity.id}>
                        <td>{formatDateTime(activity.created_at)}</td>
                        <td>{formatActivityType(activity.activity_type)}</td>
                        <td>{activity.lead__company_name}</td>
                        <td>{activity.is_countable_for_kpi ? 'Yes' : 'No'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </section>

          {detail.checkout_report ? (
            <section className="sales-cc-section">
              <h2 className="sales-cc-section__title">Checkout report</h2>
              <div className="sales-cc-report">
                <p className="muted">
                  Check-in: {detail.checkout_report.check_in_time || '—'} · Check-out:{' '}
                  {detail.checkout_report.check_out_time || '—'}
                </p>
                {detail.checkout_report.daily_report_summary ? (
                  <div className="sales-cc-report__grid">
                    {Object.entries(detail.checkout_report.daily_report_summary).map(([key, value]) => (
                      <div key={key} className="sales-cc-report__item">
                        <strong>{key.replaceAll('_', ' ')}</strong>
                        <p>{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No daily report submitted.</p>
                )}
                {detail.checkout_report.tomorrow_plan ? (
                  <div className="sales-cc-report__item">
                    <strong>Tomorrow Plan</strong>
                    <p>{detail.checkout_report.tomorrow_plan}</p>
                  </div>
                ) : null}
                {detail.checkout_report.kpi_miss_reason ? (
                  <div className="sales-cc-report__item sales-cc-report__item--warning">
                    <strong>KPI Miss Reason</strong>
                    <p>{detail.checkout_report.kpi_miss_reason}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="sales-cc-section">
            <h2 className="sales-cc-section__title">Not counted activities</h2>
            <div className="ui-table-wrap">
              <Table className="ui-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Lead</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.not_counted_activities.length === 0 && detail.not_counted_status_changes.length === 0 ? (
                    <tr><td colSpan={4} className="muted">No suspicious or not-counted items in selected period.</td></tr>
                  ) : (
                    <>
                      {detail.not_counted_activities.map((activity) => (
                        <tr key={`activity-${activity.id}`}>
                          <td>{formatDateTime(activity.created_at)}</td>
                          <td>{formatActivityType(activity.activity_type)}</td>
                          <td>{activity.lead__company_name}</td>
                          <td>{activity.notes || '—'}</td>
                        </tr>
                      ))}
                      {detail.not_counted_status_changes.map((change) => (
                        <tr key={`status-${change.id}`}>
                          <td>{formatDateTime(change.changed_at)}</td>
                          <td>Status Change</td>
                          <td>{change.lead__company_name}</td>
                          <td>
                            {change.previous_status.replaceAll('_', ' ')} → {change.new_status.replaceAll('_', ' ')}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </Table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
