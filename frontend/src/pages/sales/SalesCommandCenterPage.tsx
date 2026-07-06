import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { SalesCcFilterField, SalesCommandCenterMetrics } from '../../components/sales/SalesCommandCenterMetrics';
import { SalesRiskAlertsPanel } from '../../components/sales/SalesRiskAlertsPanel';
import { getKpiStatusClass } from '../../components/sales/kpiDisplayStatus';
import { ApiError } from '../../services/api';
import {
  salesService,
  type SalesCommandCenterFilters,
  type SalesCommandCenterPeriod,
  type SalesCommandCenterSummary,
  type SalesEmployeeKpiRow,
} from '../../services/salesService';
import { LEAD_SERVICE_FIT_OPTIONS, LEAD_STATUS_OPTIONS } from '../../types/lead';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getCheckoutLabel(row: SalesEmployeeKpiRow): { label: string; tone: 'neutral' | 'success' | 'danger' } {
  const checkout = row.last_checkout_status;
  if (checkout.checked_out) {
    if (checkout.kpi_matched === false) {
      return { label: 'Checked out · KPI miss', tone: 'danger' };
    }
    return { label: 'Checked out', tone: 'success' };
  }
  if (checkout.status === 'Checked In') {
    return { label: 'Checked in', tone: 'neutral' };
  }
  return { label: checkout.status, tone: 'neutral' };
}

export function SalesCommandCenterPage() {
  const [summary, setSummary] = useState<SalesCommandCenterSummary | null>(null);
  const [rows, setRows] = useState<SalesEmployeeKpiRow[]>([]);
  const [periodMeta, setPeriodMeta] = useState<{ start: string; end: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<SalesCommandCenterFilters>({
    date: todayIso(),
    period: 'daily',
    employee_id: '',
    kpi_status: '',
    service_fit: '',
    lead_status: '',
  });

  const periodLabel = useMemo(() => {
    if (filters.period === 'weekly') return 'This week';
    if (filters.period === 'monthly') return 'This month';
    return 'Selected day';
  }, [filters.period]);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [summaryData, employeeData] = await Promise.all([
          salesService.getCommandCenterSummary(filters),
          salesService.getCommandCenterEmployees(filters),
        ]);
        if (!active) return;
        setSummary(summaryData);
        setRows(employeeData.rows);
        setPeriodMeta({ start: employeeData.period_start, end: employeeData.period_end });
      } catch (err) {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load Sales Command Center.');
        setSummary(null);
        setRows([]);
        setPeriodMeta(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [filters]);

  const updateFilter = <K extends keyof SalesCommandCenterFilters>(key: K, value: SalesCommandCenterFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const loadingValue = (value: number | undefined) => (isLoading ? '—' : value ?? 0);

  return (
    <div className="sales-cc">
      <header className="sales-cc-hero">
        <div className="sales-cc-hero__glow" aria-hidden />
        <div className="sales-cc-hero__content">
          <span className="sales-cc-hero__eyebrow">Super Admin · Sales & Marketing</span>
          <h1 className="sales-cc-hero__title">Sales Command Center</h1>
          <p className="sales-cc-hero__description">
            Live team performance, checkout health, and anti-cheat visibility in one place.
          </p>
        </div>
        <div className="sales-cc-hero__aside">
          <div className="sales-cc-hero__date-card">
            <span className="sales-cc-hero__date-label">Reporting date</span>
            <strong>{formatDisplayDate(filters.date ?? todayIso())}</strong>
          </div>
          <span className="sales-cc-hero__pill">Read-only audit view</span>
        </div>
      </header>

      <section className="sales-cc-filters-panel">
        <div className="sales-cc-filters-panel__head">
          <h2>Filters</h2>
          <p>Refine team KPI and employee table results.</p>
        </div>
        <div className="sales-cc-filters">
          <SalesCcFilterField label="Employee">
            <select
              value={filters.employee_id ?? ''}
              onChange={(e) => updateFilter('employee_id', e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All sales employees</option>
              {(summary?.sales_employees ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </SalesCcFilterField>
          <SalesCcFilterField label="Date">
            <input
              type="date"
              value={filters.date ?? todayIso()}
              onChange={(e) => updateFilter('date', e.target.value)}
            />
          </SalesCcFilterField>
          <SalesCcFilterField label="Period">
            <select
              value={filters.period ?? 'daily'}
              onChange={(e) => updateFilter('period', e.target.value as SalesCommandCenterPeriod)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </SalesCcFilterField>
          <SalesCcFilterField label="KPI status">
            <select value={filters.kpi_status ?? ''} onChange={(e) => updateFilter('kpi_status', e.target.value)}>
              <option value="">All</option>
              <option value="matched">Matched</option>
              <option value="at_risk">At risk</option>
              <option value="missed">Not matched</option>
            </select>
          </SalesCcFilterField>
          <SalesCcFilterField label="Service fit">
            <select value={filters.service_fit ?? ''} onChange={(e) => updateFilter('service_fit', e.target.value)}>
              <option value="">All</option>
              {LEAD_SERVICE_FIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SalesCcFilterField>
          <SalesCcFilterField label="Lead status">
            <select value={filters.lead_status ?? ''} onChange={(e) => updateFilter('lead_status', e.target.value)}>
              <option value="">All</option>
              {LEAD_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SalesCcFilterField>
        </div>
        {error ? <p className="sales-cc-error">{error}</p> : null}
      </section>

      <SalesCommandCenterMetrics
        variant="highlight"
        title="Executive snapshot"
        subtitle="High-level team coverage and KPI compliance."
        metrics={[
          { id: 'employees', label: 'Sales team', value: loadingValue(summary?.total_sales_employees), tone: 'purple' },
          { id: 'leads', label: 'Total leads', value: loadingValue(summary?.total_leads), tone: 'cyan' },
          { id: 'matched', label: 'KPI matched', value: loadingValue(summary?.kpi_matched_employees), tone: 'success' },
          { id: 'missed', label: 'KPI missed', value: loadingValue(summary?.kpi_missed_employees), tone: 'danger' },
        ]}
      />

      <SalesCommandCenterMetrics
        title="Pipeline activity"
        subtitle={`Counts for ${formatDisplayDate(summary?.date ?? filters.date ?? todayIso())}.`}
        metrics={[
          { id: 'leads-today', label: 'Leads added', value: loadingValue(summary?.leads_added_today), tone: 'teal' },
          { id: 'dm-today', label: 'Decision makers', value: loadingValue(summary?.decision_makers_added_today), tone: 'purple' },
          { id: 'calls', label: 'Calls', value: loadingValue(summary?.calls_today), tone: 'amber' },
          { id: 'linkedin', label: 'LinkedIn', value: loadingValue(summary?.linkedin_outreach_today), tone: 'cyan' },
          { id: 'followups', label: 'Follow-ups', value: loadingValue(summary?.follow_ups_today), tone: 'slate' },
          { id: 'interested', label: 'Interested', value: loadingValue(summary?.interested_leads_today), tone: 'success' },
          { id: 'meetings', label: 'Meetings', value: loadingValue(summary?.meetings_booked), tone: 'teal' },
          { id: 'proposal', label: 'Proposals', value: loadingValue(summary?.proposal_sent), tone: 'amber' },
        ]}
      />

      <SalesCommandCenterMetrics
        variant="health"
        title="Risk & integrity"
        subtitle="Items that need Super Admin review."
        metrics={[
          {
            id: 'suspicious',
            label: 'Not counted / suspicious',
            value: loadingValue(summary?.suspicious_not_counted_activities),
            tone: 'danger',
            hint: 'Activities flagged as non-countable today',
          },
        ]}
      />

      <section className="sales-cc-section sales-cc-team">
        <div className="sales-cc-section__head">
          <div>
            <h2 className="sales-cc-section__title">Employee performance</h2>
            <p className="sales-cc-section__subtitle">
              {periodLabel}
              {periodMeta ? ` · ${periodMeta.start} to ${periodMeta.end}` : ''}
            </p>
          </div>
          <span className="sales-cc-team__count">{rows.length} employee{rows.length === 1 ? '' : 's'}</span>
        </div>

        {isLoading ? (
          <div className="sales-cc-empty">Loading team KPI...</div>
        ) : rows.length === 0 ? (
          <div className="sales-cc-empty">No sales employees match the selected filters.</div>
        ) : (
          <div className="sales-cc-team-list">
            {rows.map((row) => {
              const checkout = getCheckoutLabel(row);
              return (
                <article key={row.employee_id} className="sales-cc-team-card">
                  <div className="sales-cc-team-card__identity">
                    <span className="sales-cc-team-card__avatar" aria-hidden>
                      {getInitials(row.employee_name)}
                    </span>
                    <div>
                      <h3>{row.employee_name}</h3>
                      <p>{row.department || 'Sales & Marketing'}</p>
                    </div>
                    <span className={['sales-cc-status', getKpiStatusClass(row.kpi_status)].filter(Boolean).join(' ')}>
                      {row.kpi_status}
                    </span>
                  </div>

                  <div className="sales-cc-team-card__metrics">
                    {[
                      { label: 'Leads', value: row.leads },
                      { label: 'DM', value: row.decision_makers },
                      { label: 'LinkedIn', value: row.linkedin },
                      { label: 'Calls', value: row.calls },
                      { label: 'Follow-ups', value: row.follow_ups },
                      { label: 'Interested', value: row.interested_leads },
                      { label: 'Meetings', value: row.meetings },
                      { label: 'Proposal', value: row.proposal_sent },
                    ].map((item) => (
                      <div key={item.label} className="sales-cc-team-card__metric">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="sales-cc-team-card__footer">
                    <span className={['sales-cc-checkout', `is-${checkout.tone}`].join(' ')}>{checkout.label}</span>
                    <Link
                      className="sales-cc-btn"
                      to={`/admin/sales/employees/${row.employee_id}?date=${filters.date ?? todayIso()}&period=${filters.period ?? 'daily'}`}
                    >
                      View details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <SalesRiskAlertsPanel employees={summary?.sales_employees ?? []} />
    </div>
  );
}
