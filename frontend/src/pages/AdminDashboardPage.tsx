import { useEffect, useMemo, useState } from 'react';

import { Badge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { employeeService } from '../services/employeeService';
import type { Employee } from '../types';
import { AdminDashboardActionCenter } from './dashboard/AdminDashboardActionCenter';
import { AdminDashboardMetrics } from './dashboard/AdminDashboardMetrics';
import { AdminDashboardOverview } from './dashboard/AdminDashboardOverview';
function DashboardHeroIllustration() {
  return (
    <svg
      className="dashboard-hero__illustration"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="60" cy="60" r="52" fill="url(#heroGlow)" />
      <circle cx="42" cy="46" r="12" fill="rgba(75, 45, 132, 0.16)" />
      <path
        d="M24 88c2.8-10.8 10.2-18 18-18s15.2 7.2 18 18"
        stroke="rgba(75, 45, 132, 0.45)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="78" cy="42" r="10" fill="rgba(40, 184, 216, 0.2)" />
      <path
        d="M64 86c2.2-8.4 8.4-14 15-14s12.8 5.6 15 14"
        stroke="rgba(40, 184, 216, 0.55)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="34" y="58" width="52" height="8" rx="4" fill="rgba(75, 45, 132, 0.12)" />
      <rect x="40" y="72" width="40" height="8" rx="4" fill="rgba(40, 184, 216, 0.14)" />
      <defs>
        <radialGradient id="heroGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="rotate(90 0 0) scale(52)">
          <stop stopColor="rgba(75, 45, 132, 0.12)" />
          <stop offset="1" stopColor="rgba(40, 184, 216, 0.04)" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const data = await employeeService.list();
        setEmployees(Array.isArray(data) ? data : []);
      } catch {
        setEmployees(null);
      }
    };
    void load();
  }, []);
  const displayName = user?.full_name || 'Super Admin';

  return (
    <div className="admin-dashboard-page dashboard-stack">
      <section className="dashboard-section dashboard-section--hero dashboard-hero" aria-label="Dashboard welcome">
        <div className="dashboard-hero__pattern" aria-hidden />
        <div className="dashboard-hero__body">
          <div className="dashboard-hero__content">
            <p className="dashboard-hero__eyebrow">Dashboard overview</p>
            <h2 className="dashboard-hero__title">Welcome back, {displayName}</h2>
            <p className="dashboard-hero__subtitle">Here is your company-wide HRMS overview for today.</p>
          </div>

          <div className="dashboard-hero__aside">
            <div className="dashboard-hero__meta">
              <time className="dashboard-hero__date" dateTime={new Date().toISOString().slice(0, 10)}>
                {todayLabel}
              </time>
              <Badge variant="success" className="dashboard-hero__status">
                <span className="dashboard-hero__status-dot" aria-hidden />
                System Active
              </Badge>
            </div>
            <DashboardHeroIllustration />
          </div>
        </div>
      </section>

      <AdminDashboardMetrics employees={employees} />

      <AdminDashboardOverview hasRecords={employees !== null && employees.length > 0} />

      <AdminDashboardActionCenter />
    </div>
  );
}