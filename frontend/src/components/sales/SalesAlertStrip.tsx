import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { salesService, type SalesRiskDashboardResponse } from '../../services/salesService';

function formatAlertType(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function SalesAlertStrip() {
  const [data, setData] = useState<SalesRiskDashboardResponse | null>(null);

  useEffect(() => {
    let active = true;
    void salesService.getRiskDashboard().then((response) => {
      if (active) setData(response);
    }).catch(() => {
      if (active) setData(null);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return null;
  }

  const hasAlerts =
    data.overdue_followups > 0 ||
    data.kpi_missed_today ||
    data.not_counted_today > 0 ||
    data.recent_alerts.length > 0;

  if (!hasAlerts) {
    return null;
  }

  return (
    <div className="sales-alert-strip" role="status" aria-live="polite">
      <div className="sales-alert-strip__header">
        <strong>Attention needed</strong>
        <span className="muted">Review items that may not count toward KPI.</span>
      </div>
      <div className="sales-alert-strip__items">
        {data.overdue_followups > 0 ? (
          <span className="sales-alert-strip__item is-high">
            {data.overdue_followups} overdue follow-up{data.overdue_followups === 1 ? '' : 's'}
          </span>
        ) : null}
        {data.kpi_missed_today ? (
          <span className="sales-alert-strip__item is-high">Daily KPI not fully matched</span>
        ) : null}
        {data.not_counted_today > 0 ? (
          <span className="sales-alert-strip__item is-medium">
            {data.not_counted_today} not-counted activit{data.not_counted_today === 1 ? 'y' : 'ies'} today
          </span>
        ) : null}
      </div>
      {data.recent_alerts.length > 0 ? (
        <ul className="sales-alert-strip__list">
          {data.recent_alerts.slice(0, 4).map((alert) => (
            <li key={alert.id}>
              <span className={`sales-alert-strip__severity is-${alert.severity.toLowerCase()}`}>
                {alert.severity}
              </span>
              <span>{formatAlertType(alert.alert_type)}: {alert.message}</span>
              {alert.lead_id ? (
                <Link className="payroll-back" to={`/employee/leads/${alert.lead_id}`}>
                  View lead
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
