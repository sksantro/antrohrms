import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { SalesCcFilterField } from './SalesCommandCenterMetrics';
import { ApiError } from '../../services/api';
import {
  salesService,
  SALES_ALERT_TYPE_OPTIONS,
  type SalesCommandCenterEmployeeOption,
  type SalesRiskAlert,
  type SalesRiskAlertFilters,
} from '../../services/salesService';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface SalesRiskAlertsPanelProps {
  employees: SalesCommandCenterEmployeeOption[];
}

export function SalesRiskAlertsPanel({ employees }: SalesRiskAlertsPanelProps) {
  const [alerts, setAlerts] = useState<SalesRiskAlert[]>([]);
  const [filters, setFilters] = useState<SalesRiskAlertFilters>({
    employee_id: '',
    severity: '',
    alert_type: '',
    date: '',
    resolved: 'false',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const loadAlerts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await salesService.listRiskAlerts(filters);
      setAlerts(response.alerts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load sales alerts.');
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, [filters]);

  const handleResolve = async (alertId: number) => {
    setResolvingId(alertId);
    try {
      await salesService.resolveRiskAlert(alertId);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to resolve alert.');
    } finally {
      setResolvingId(null);
    }
  };

  const openCount = alerts.filter((alert) => !alert.is_resolved).length;

  return (
    <section className="sales-cc-section sales-cc-alerts">
      <div className="sales-cc-section__head">
        <div>
          <h2 className="sales-cc-section__title">Suspicious activity & alerts</h2>
          <p className="sales-cc-section__subtitle">Review anti-cheat events and mark them resolved after audit.</p>
        </div>
        <span className="sales-cc-alerts__badge">{openCount} open</span>
      </div>

      <div className="sales-cc-filters sales-cc-filters--compact">
        <SalesCcFilterField label="Employee">
          <select
            value={filters.employee_id ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, employee_id: e.target.value ? Number(e.target.value) : '' }))}
          >
            <option value="">All</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        </SalesCcFilterField>
        <SalesCcFilterField label="Severity">
          <select value={filters.severity ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}>
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </SalesCcFilterField>
        <SalesCcFilterField label="Alert type">
          <select value={filters.alert_type ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, alert_type: e.target.value }))}>
            <option value="">All</option>
            {SALES_ALERT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SalesCcFilterField>
        <SalesCcFilterField label="Date">
          <input type="date" value={filters.date ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))} />
        </SalesCcFilterField>
        <SalesCcFilterField label="Status">
          <select
            value={filters.resolved ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, resolved: e.target.value as SalesRiskAlertFilters['resolved'] }))}
          >
            <option value="">All</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </SalesCcFilterField>
      </div>

      {error ? <p className="sales-cc-error">{error}</p> : null}

      {isLoading ? (
        <div className="sales-cc-empty">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="sales-cc-empty sales-cc-empty--success">
          <strong>All clear</strong>
          <span>No alerts match the selected filters.</span>
        </div>
      ) : (
        <div className="sales-cc-alert-list">
          {alerts.map((alert) => (
            <article key={alert.id} className={['sales-cc-alert-card', alert.is_resolved ? 'is-resolved' : ''].filter(Boolean).join(' ')}>
              <div className="sales-cc-alert-card__top">
                <span className={`sales-cc-severity is-${alert.severity.toLowerCase()}`}>{alert.severity_display}</span>
                <time>{formatDateTime(alert.created_at)}</time>
              </div>
              <h3>{alert.alert_type_display}</h3>
              <p>{alert.message}</p>
              <div className="sales-cc-alert-card__meta">
                <span>{alert.employee_name}</span>
                {alert.lead_id ? (
                  <Link to={`/admin/leads/${alert.lead_id}`}>{alert.lead_name}</Link>
                ) : (
                  <span>No linked lead</span>
                )}
                <span className={alert.is_resolved ? 'is-resolved' : 'is-open'}>
                  {alert.is_resolved ? 'Resolved' : 'Open'}
                </span>
              </div>
              {!alert.is_resolved ? (
                <button
                  type="button"
                  className="sales-cc-btn sales-cc-btn--ghost"
                  onClick={() => void handleResolve(alert.id)}
                  disabled={resolvingId === alert.id}
                >
                  {resolvingId === alert.id ? 'Saving...' : 'Mark resolved'}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
