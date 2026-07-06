import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { CheckInOutPanel } from '../components/attendance/CheckInOutPanel';
import { LeadTable } from '../components/leads/LeadTable';
import { Card } from '../components/ui';
import { AssignedServiceCategories } from '../components/sales/AssignedServiceCategories';
import { SalesAlertStrip } from '../components/sales/SalesAlertStrip';
import { SalesKpiSummary } from '../components/sales/SalesKpiSummary';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/api';
import { attendanceService } from '../services/attendanceService';
import { leadService } from '../services/leadService';
import type { Attendance } from '../types';
import type { Lead } from '../types/lead';
import { getLeadsBasePath, getLeadsListPath } from '../utils/rbac';

export function SalesMarketingDashboardPage() {
  const { user, can } = useAuth();
  const leadsPath = user ? getLeadsBasePath(user.role) : '/employee/leads';
  const listPath = user ? getLeadsListPath(user.role) : '/employee/leads/list';
  const showLeadsLink = can('can_view_leads');
  const [today, setToday] = useState<Attendance | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [recentLeadsError, setRecentLeadsError] = useState<string | null>(null);
  const [recentLeadsLoading, setRecentLeadsLoading] = useState(true);

  useEffect(() => {
    const loadToday = async () => {
      try {
        const data = await attendanceService.getMy();
        setToday(data.today);
      } catch {
        setToday(null);
      }
    };
    void loadToday();
  }, []);

  useEffect(() => {
    if (!showLeadsLink) {
      setRecentLeadsLoading(false);
      return;
    }

    const loadRecentLeads = async () => {
      setRecentLeadsLoading(true);
      setRecentLeadsError(null);
      try {
        const data = await leadService.getDashboard();
        setRecentLeads(data.recent_leads);
      } catch (err) {
        setRecentLeadsError(err instanceof ApiError ? err.message : 'Unable to load recent leads.');
        setRecentLeads([]);
      } finally {
        setRecentLeadsLoading(false);
      }
    };

    void loadRecentLeads();
  }, [showLeadsLink]);

  return (
    <div className="dashboard-stack sales-dashboard">
      <Card wide className="dashboard-section sales-dashboard-hero">
        <div className="dashboard-welcome">
          <h2>Sales & Marketing Dashboard</h2>
          <p className="muted">
            Welcome, {user?.full_name ?? 'team member'}. Track service categories, daily KPIs, and
            company leads.
          </p>
        </div>
        <SalesAlertStrip />
      </Card>

      <Card wide className="dashboard-section sales-dashboard-categories">
        <div className="sales-dashboard-section__header">
          <h3 className="sales-dashboard-section__title">Assigned Service Categories</h3>
          <p className="sales-dashboard-section__description">
            Your assigned business lines and service offerings for Sales & Marketing.
          </p>
        </div>
        <AssignedServiceCategories />
      </Card>

      <Card wide className="dashboard-section sales-dashboard-kpi">
        <div className="sales-dashboard-section__header">
          <h3 className="sales-dashboard-section__title">KPI Summary</h3>
          <p className="sales-dashboard-section__description">
            Track outreach, lead generation, and conversion targets by period.
          </p>
        </div>
        <SalesKpiSummary />
      </Card>

      {showLeadsLink ? (
        <Card wide className="sales-dashboard-section sales-dashboard-recent-leads">
          <div className="sales-dashboard-section__header sales-dashboard-section__header--actions">
            <div>
              <h3 className="sales-dashboard-section__title">Recent Leads</h3>
              <p className="sales-dashboard-section__description">
                Last 5 recently added or updated company leads.
              </p>
            </div>
            <Link className="payroll-primary-btn" to={listPath}>
              View All Leads
            </Link>
          </div>
          {recentLeadsError ? <p className="form-error">{recentLeadsError}</p> : null}
          <div className="lead-table-wrap">
            {recentLeadsLoading ? (
              <p className="muted">Loading recent leads...</p>
            ) : (
              <LeadTable leads={recentLeads} basePath={leadsPath} compact />
            )}
          </div>
        </Card>
      ) : null}

      <Card wide padding="md" className="dashboard-section">
        <CheckInOutPanel today={today} onUpdated={() => void attendanceService.getMy().then((data) => setToday(data.today))} compact />
      </Card>

      {showLeadsLink ? (
        <Card wide className="sales-dashboard-section">
          <div className="sales-dashboard-section__header">
            <h3 className="sales-dashboard-section__title">Lead Management</h3>
            <p className="sales-dashboard-section__description">
              Capture and review company leads across your sales pipeline.
            </p>
          </div>
          <Link className="payroll-primary-btn sales-leads-link" to={leadsPath}>
            Open Lead Management
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
