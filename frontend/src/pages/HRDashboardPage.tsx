import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import { Card, StatCard, StatGrid } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { sidebarIcons, type SidebarIconName } from '../layouts/sidebarIcons';
import {
  EMPTY_HR_DASHBOARD_METRICS,
  loadHRDashboardMetrics,
  type HRDashboardMetrics,
} from '../services/hrDashboardService';

const quickLinks: Array<{
  to: string;
  label: string;
  description: string;
  icon: SidebarIconName;
}> = [
  {
    to: '/hr/employees',
    label: 'Employees',
    description: 'View and manage employee records',
    icon: 'employees',
  },
  {
    to: '/hr/offer-letters',
    label: 'Offer Letters',
    description: 'Generate and track offer letters',
    icon: 'idCard',
  },
  {
    to: '/hr/onboarding',
    label: 'Onboarding',
    description: 'Manage new hire onboarding journeys',
    icon: 'profile',
  },
  {
    to: '/hr/policies',
    label: 'Policies',
    description: 'Manage HR policies',
    icon: 'policy',
  },
  {
    to: '/hr/policy-compliance',
    label: 'Policy Compliance',
    description: 'Track acknowledgements',
    icon: 'shield',
  },
  {
    to: '/hr/leave-management',
    label: 'Leave Management',
    description: 'Review and approve leave requests',
    icon: 'leaves',
  },
  {
    to: '/hr/attendance',
    label: 'Attendance View',
    description: 'Monitor company attendance',
    icon: 'attendance',
  },
  {
    to: '/hr/my-profile',
    label: 'My Profile',
    description: 'View and update your profile',
    icon: 'profile',
  },
];

type SummaryCardTone = 'purple' | 'indigo' | 'cyan' | 'amber' | 'rose' | 'teal' | 'green' | 'slate';

interface SummaryCardConfig {
  key: keyof HRDashboardMetrics;
  label: string;
  hint: string;
  to?: string;
  tone: SummaryCardTone;
}

const summaryCards: SummaryCardConfig[] = [
  {
    key: 'totalEmployees',
    label: 'Total Employees',
    hint: 'All employee records',
    to: '/hr/employees',
    tone: 'purple',
  },
  {
    key: 'activeEmployees',
    label: 'Active Employees',
    hint: 'Currently active staff',
    to: '/hr/employees',
    tone: 'indigo',
  },
  {
    key: 'pendingOnboarding',
    label: 'Pending Onboarding',
    hint: 'Awaiting onboarding start',
    to: '/hr/onboarding',
    tone: 'cyan',
  },
  {
    key: 'pendingOfferAcceptance',
    label: 'Pending Offer Acceptance',
    hint: 'Offers awaiting acceptance',
    to: '/hr/offer-letters',
    tone: 'amber',
  },
  {
    key: 'pendingPolicyAcknowledgements',
    label: 'Pending Policy Acknowledgements',
    hint: 'Policies not yet acknowledged',
    to: '/hr/policy-compliance',
    tone: 'rose',
  },
  {
    key: 'pendingLeaveRequests',
    label: 'Pending Leave Requests',
    hint: 'Awaiting HR action',
    to: '/hr/leave-management',
    tone: 'teal',
  },
  {
    key: 'todayPresent',
    label: 'Today Present',
    hint: 'Present, late, or half-day',
    to: '/hr/attendance',
    tone: 'green',
  },
  {
    key: 'todayAbsent',
    label: 'Today Absent',
    hint: 'Marked absent today',
    to: '/hr/attendance',
    tone: 'slate',
  },
];

function formatMetricValue(value: number, loading: boolean): string {
  return loading ? '—' : String(value);
}

function formatTodayLabel(): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function HRDashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<HRDashboardMetrics>(EMPTY_HR_DASHBOARD_METRICS);
  const [loading, setLoading] = useState(true);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const result = await loadHRDashboardMetrics();
        if (!active) {
          return;
        }
        setMetrics(result.metrics);
        setPartialErrors(result.partialErrors);
      } catch {
        if (!active) {
          return;
        }
        setMetrics(EMPTY_HR_DASHBOARD_METRICS);
        setPartialErrors(['HR dashboard summary']);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const displayName = user?.full_name?.split(' ')[0] ?? 'there';

  const pendingActions = useMemo(
    () =>
      metrics.pendingOnboarding +
      metrics.pendingOfferAcceptance +
      metrics.pendingPolicyAcknowledgements +
      metrics.pendingLeaveRequests,
    [metrics],
  );

  return (
    <div className="dashboard-stack hr-dashboard">
      <Card wide className="hr-dashboard-hero">
        <div className="hr-dashboard-hero__inner">
          <div className="hr-dashboard-hero__content">
            <span className="hr-dashboard-hero__badge">HR Workspace</span>
            <h2>Welcome back, {displayName}</h2>
            <p className="hr-dashboard-hero__description">
              Your operational overview for people, policies, leave, and attendance.
            </p>
            <p className="hr-dashboard-hero__date">{formatTodayLabel()}</p>
          </div>
          <div className="hr-dashboard-hero__stats">
            <div className="hr-dashboard-hero__stat">
              <span className="hr-dashboard-hero__stat-value">
                {formatMetricValue(metrics.activeEmployees, loading)}
              </span>
              <span className="hr-dashboard-hero__stat-label">Active Team</span>
            </div>
            <div className="hr-dashboard-hero__stat hr-dashboard-hero__stat--accent">
              <span className="hr-dashboard-hero__stat-value">
                {formatMetricValue(pendingActions, loading)}
              </span>
              <span className="hr-dashboard-hero__stat-label">Pending Actions</span>
            </div>
          </div>
        </div>
      </Card>

      {partialErrors.length > 0 ? (
        <div className="hr-dashboard-alert" role="status">
          <p>
            Some dashboard metrics could not be loaded ({partialErrors.join(', ')}). Showing safe
            fallback values where needed.
          </p>
        </div>
      ) : null}

      <section className="hr-dashboard-section" aria-labelledby="hr-dashboard-summary-title">
        <div className="hr-dashboard-section__header">
          <div>
            <h3 id="hr-dashboard-summary-title" className="hr-dashboard-section__title">
              Operational Summary
            </h3>
            <p className="hr-dashboard-section__description">
              Live HR metrics across employees, onboarding, policies, leave, and attendance.
            </p>
          </div>
          {loading ? <span className="hr-dashboard-section__status">Refreshing…</span> : null}
        </div>

        <StatGrid>
          {summaryCards.map((card) => (
            <StatCard
              key={card.key}
              label={card.label}
              value={formatMetricValue(metrics[card.key], loading)}
              hint={card.hint}
              to={card.to}
              className={`hr-dashboard-kpi hr-dashboard-kpi--${card.tone}`}
            />
          ))}
        </StatGrid>
      </section>

      <Card wide className="hr-dashboard-panel">
        <div className="hr-dashboard-panel__header">
          <div>
            <h3 className="hr-dashboard-panel__title">Quick Actions</h3>
            <p className="hr-dashboard-panel__description">
              Jump into your most-used HR workflows.
            </p>
          </div>
        </div>
        <div className="hr-dashboard-links">
          {quickLinks.map((link) => {
            const Icon = sidebarIcons[link.icon];
            return (
              <Link key={link.to} to={link.to} className="hr-dashboard-link">
                <span className="hr-dashboard-link__icon">
                  <Icon />
                </span>
                <span className="hr-dashboard-link__copy">
                  <span className="hr-dashboard-link__title">{link.label}</span>
                  <span className="hr-dashboard-link__description">{link.description}</span>
                </span>
                <span className="hr-dashboard-link__arrow" aria-hidden>
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
