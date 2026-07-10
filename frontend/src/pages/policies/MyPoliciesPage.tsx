import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AcknowledgementStatusBadge } from '../../components/policies/AcknowledgementStatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { policyService } from '../../services/policyService';
import type { Policy } from '../../types';
import { formatPolicyCategory, getHrMyPoliciesBasePath } from '../../utils/rbac';

export function MyPoliciesPage() {
  const { user } = useAuth();
  const basePath = user ? getHrMyPoliciesBasePath(user.role, user.department) : '/employee/policies';
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACKNOWLEDGED'>('ALL');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await policyService.getMy();
        setAllPolicies(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load policies.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = allPolicies.filter((policy) => {
    if (filter === 'ALL') return true;
    return policy.acknowledgement_status === filter;
  });

  const pendingCount = allPolicies.filter((p) => p.acknowledgement_status === 'PENDING').length;
  const acknowledgedCount = allPolicies.filter((p) => p.acknowledgement_status === 'ACKNOWLEDGED').length;

  return (
    <section className="payroll-card">
      <div className="payroll-header">
        <div>
          <h2 className="payroll-title">My Policies</h2>
          <p className="payroll-subtitle">
            Review company policies and acknowledge pending items.
            {pendingCount > 0 ? ` You have ${pendingCount} pending.` : ''}
          </p>
        </div>
        {pendingCount > 0 ? (
          <Link className="payroll-action" to={`${basePath}/pending`}>Pending Acknowledgements</Link>
        ) : null}
      </div>

      <div className="payroll-kpi-grid">
        <article className="payroll-kpi-card"><p className="payroll-kpi-card__label">Assigned Policies</p><p className="payroll-kpi-card__value">{allPolicies.length}</p></article>
        <article className="payroll-kpi-card"><p className="payroll-kpi-card__label">Pending</p><p className="payroll-kpi-card__value">{pendingCount}</p></article>
        <article className="payroll-kpi-card"><p className="payroll-kpi-card__label">Acknowledged</p><p className="payroll-kpi-card__value">{acknowledgedCount}</p></article>
      </div>

      <div className="filter-bar">
        <button
          type="button"
          className={filter === 'ALL' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setFilter('ALL')}
        >
          All
        </button>
        <button
          type="button"
          className={filter === 'PENDING' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setFilter('PENDING')}
        >
          Pending
        </button>
        <button
          type="button"
          className={filter === 'ACKNOWLEDGED' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setFilter('ACKNOWLEDGED')}
        >
          Acknowledged
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? (
        <p className="muted payroll-loading">Loading policies...</p>
      ) : !filtered.length ? (
        <p className="muted">No policies found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Version</th>
                <th>Effective Date</th>
                <th>Status</th>
                <th>Acknowledgement Required</th>
                <th>Acknowledged Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((policy) => (
                <tr key={policy.id}>
                  <td>{policy.title}</td>
                  <td>{formatPolicyCategory(policy.category)}</td>
                  <td>{policy.version}</td>
                  <td>{policy.effective_date}</td>
                  <td>
                    {policy.acknowledgement_status ? (
                      <AcknowledgementStatusBadge status={policy.acknowledgement_status} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{policy.requires_acknowledgement ? 'Yes' : 'No'}</td>
                  <td>
                    {policy.employee_acknowledged_at
                      ? new Date(policy.employee_acknowledged_at).toLocaleString('en-IN')
                      : '—'}
                  </td>
                  <td>
                    <Link to={`${basePath}/${policy.id}`}>
                      {policy.acknowledgement_status === 'PENDING' ? 'Review & Acknowledge' : 'View'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
