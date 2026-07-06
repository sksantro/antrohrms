import { Link } from 'react-router-dom';

import { Table } from '../ui';
import type { Lead } from '../../types/lead';
import { formatLeadServiceFit } from '../../utils/rbac';
import { InboxIcon } from './leadIcons';
import { LeadStatusBadge } from './LeadStatusBadge';

interface LeadTableProps {
  leads: Lead[];
  basePath: string;
  onEdit?: (lead: Lead) => void;
  onChangeStatus?: (lead: Lead) => void;
  onAddActivity?: (lead: Lead) => void;
  compact?: boolean;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LeadTable({
  leads,
  basePath,
  onEdit,
  onChangeStatus,
  onAddActivity,
  compact = false,
}: LeadTableProps) {
  if (leads.length === 0) {
    return (
      <div className="lead-empty">
        <span className="lead-empty__icon">
          <InboxIcon />
        </span>
        <h4>No leads yet</h4>
        <p>Created leads will appear here. Use Add Lead to capture your first company.</p>
      </div>
    );
  }

  return (
    <Table className="payroll-table lead-table">
      <thead>
        <tr>
          <th>Company</th>
          {!compact ? <th>Country</th> : null}
          {!compact ? <th>Industry</th> : null}
          <th>Service Fit</th>
          <th>Status</th>
          {!compact ? <th>Priority</th> : null}
          {!compact ? <th>Owner</th> : null}
          {!compact ? <th>Next Follow-up</th> : null}
          {!compact ? <th>Last Activity</th> : null}
          {!compact ? <th>Contacts</th> : null}
          <th>{compact ? 'Updated' : 'Created Date'}</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr key={lead.id}>
            <td>
              <div className="lead-company">
                <span className="lead-company__name">{lead.company_name}</span>
                {lead.website ? (
                  <a
                    className="lead-company__website"
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {lead.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <span className="lead-company__website lead-company__website--muted">—</span>
                )}
              </div>
            </td>
            {!compact ? <td>{lead.country}</td> : null}
            {!compact ? <td>{lead.industry}</td> : null}
            <td>
              <span className="lead-service-pill">{formatLeadServiceFit(lead.service_fit)}</span>
            </td>
            <td>
              <LeadStatusBadge status={lead.current_status} />
            </td>
            {!compact ? (
              <td>
                <span className="lead-priority-pill">{lead.priority_display}</span>
              </td>
            ) : null}
            {!compact ? <td>{lead.lead_owner_name}</td> : null}
            {!compact ? <td className="lead-date">{formatDate(lead.next_follow_up_date)}</td> : null}
            {!compact ? <td className="lead-date">{formatDateTime(lead.last_activity_date)}</td> : null}
            {!compact ? (
              <td>
                <span className="lead-contact-count">{lead.contact_count ?? 0}</span>
              </td>
            ) : null}
            <td className="lead-date">
              {formatDate(compact ? lead.updated_at : lead.created_at)}
            </td>
            <td>
              <div className="lead-table-actions">
                <Link className="payroll-action" to={`${basePath}/${lead.id}`}>
                  View
                </Link>
                {onEdit ? (
                  <button type="button" className="payroll-action" onClick={() => onEdit(lead)}>
                    Edit
                  </button>
                ) : null}
                {onChangeStatus ? (
                  <button type="button" className="payroll-action" onClick={() => onChangeStatus(lead)}>
                    Status
                  </button>
                ) : null}
                {onAddActivity ? (
                  <button type="button" className="payroll-action" onClick={() => onAddActivity(lead)}>
                    Activity
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
