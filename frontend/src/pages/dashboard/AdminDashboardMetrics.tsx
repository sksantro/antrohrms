import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { Employee } from '../../types';

type MetricTone = 'purple' | 'cyan' | 'amber' | 'teal';

interface DashboardMetric {
  label: string;
  value: ReactNode;
  hint: string;
  to: string;
  tone: MetricTone;
  icon: ReactNode;
  valueType?: 'number' | 'text';
}

function EmployeesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LeavesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  );
}

function AttendanceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function buildMetrics(employees: Employee[] | null): DashboardMetric[] {
  const total = employees?.length ?? null;
  const activeCount = employees?.filter((employee) => employee.status === 'ACTIVE').length ?? null;
  const activePercent =
    total && activeCount !== null && total > 0 ? `${Math.round((activeCount / total) * 100)}% active` : 'Workforce status';

  return [
    {
      label: 'Total Employees',
      value: total ?? '—',
      hint: 'Company workforce',
      to: '/admin/employees',
      tone: 'purple',
      icon: <EmployeesIcon />,
    },
    {
      label: 'Active Users',
      value: activeCount ?? '—',
      hint: activePercent,
      to: '/admin/users',
      tone: 'cyan',
      icon: <UsersIcon />,
    },
    {
      label: 'Pending Leaves',
      value: 'Review',
      hint: 'Needs review',
      to: '/admin/leaves/requests',
      tone: 'amber',
      icon: <LeavesIcon />,
      valueType: 'text',
    },
    {
      label: 'Attendance Today',
      value: 'Manage',
      hint: 'Updated today',
      to: '/admin/attendance',
      tone: 'teal',
      icon: <AttendanceIcon />,
      valueType: 'text',
    },
  ];
}

interface AdminDashboardMetricsProps {
  employees: Employee[] | null;
}

export function AdminDashboardMetrics({ employees }: AdminDashboardMetricsProps) {
  const metrics = buildMetrics(employees);

  return (
    <section className="dashboard-section dashboard-section--metrics dashboard-metric-grid" aria-label="Dashboard metrics">
      {metrics.map((metric) => (
        <Link
          key={metric.label}
          to={metric.to}
          className={`dashboard-metric-card dashboard-metric-card--${metric.tone}`}
        >
          <div className={`dashboard-metric-card__icon dashboard-metric-card__icon--${metric.tone}`}>
            {metric.icon}
          </div>
          <div className="dashboard-metric-card__content">
            <span className="dashboard-metric-card__label">{metric.label}</span>
            <strong
              className={[
                'dashboard-metric-card__value',
                metric.valueType === 'text' ? 'dashboard-metric-card__value--text' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {metric.value}
            </strong>
            <span className="dashboard-metric-card__hint">{metric.hint}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
