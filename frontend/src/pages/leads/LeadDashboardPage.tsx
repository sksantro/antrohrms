import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { BuildingLeadIcon, LeadIcon } from '../../components/leads/leadIcons';
import { LeadTable } from '../../components/leads/LeadTable';
import { PayrollKpiCard, PayrollKpiGrid } from '../../components/payroll/PayrollKpis';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leadService } from '../../services/leadService';
import type { LeadDashboardStats } from '../../types/lead';
import { getLeadsBasePath, getLeadsListPath, getLeadsUploadPath } from '../../utils/rbac';

const STAT_HINTS: Record<keyof LeadDashboardStats, string> = {
  total: 'All captured companies',
  new: 'New status',
  contacted: 'Contacted status',
  interested: 'Interested status',
  follow_up_required: 'Follow-up required',
  meeting_booked: 'Meeting booked',
  proposal_sent: 'Proposal sent',
  not_interested: 'Not interested',
  closed: 'Closed',
  lost: 'Lost',
};

const STAT_CARDS: { key: keyof LeadDashboardStats; label: string }[] = [
  { key: 'total', label: 'Total Leads' },
  { key: 'new', label: 'New Leads' },
  { key: 'contacted', label: 'Contacted Leads' },
  { key: 'interested', label: 'Interested Leads' },
  { key: 'follow_up_required', label: 'Follow-up Required' },
  { key: 'meeting_booked', label: 'Meeting Booked' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'not_interested', label: 'Not Interested' },
  { key: 'closed', label: 'Closed' },
  { key: 'lost', label: 'Lost' },
];

export function LeadDashboardPage() {
  const { user } = useAuth();
  const basePath = user ? getLeadsBasePath(user.role) : '/employee/leads';
  const listPath = user ? getLeadsListPath(user.role) : '/employee/leads/list';
  const uploadPath = user ? getLeadsUploadPath(user.role) : '/employee/leads/upload';
  const [stats, setStats] = useState<LeadDashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Awaited<ReturnType<typeof leadService.getDashboard>>['recent_leads']>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await leadService.getDashboard();
        setStats(data.stats);
        setRecentLeads(data.recent_leads);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load lead dashboard.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="payroll-page lead-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <div className="lead-page__title-row">
              <span className="lead-page__title-icon" aria-hidden>
                <LeadIcon />
              </span>
              <div>
                <h2 className="payroll-title">Lead Dashboard</h2>
                <p className="payroll-subtitle">
                  Pipeline overview and recently updated company leads.
                </p>
              </div>
            </div>
          </div>
          <div className="payroll-header__actions">
            <Link className="payroll-primary-btn" to={listPath}>
              View All Leads
            </Link>
            <Link className="payroll-back" to={uploadPath}>
              Bulk Upload
            </Link>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {isLoading ? (
          <p className="muted">Loading dashboard...</p>
        ) : stats ? (
          <PayrollKpiGrid>
            {STAT_CARDS.map((card) => (
              <PayrollKpiCard
                key={card.key}
                label={card.label}
                value={stats[card.key]}
                hint={STAT_HINTS[card.key]}
                icon={card.key === 'total' ? <BuildingLeadIcon /> : <LeadIcon />}
              />
            ))}
          </PayrollKpiGrid>
        ) : null}
      </section>

      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h3 className="payroll-title payroll-title--sm">Recently Added / Updated</h3>
            <p className="payroll-subtitle">Last 5 leads by latest activity</p>
          </div>
        </div>
        <div className="lead-table-wrap">
          {isLoading ? (
            <p className="muted">Loading recent leads...</p>
          ) : (
            <LeadTable leads={recentLeads} basePath={basePath} compact />
          )}
        </div>
      </section>
    </div>
  );
}
