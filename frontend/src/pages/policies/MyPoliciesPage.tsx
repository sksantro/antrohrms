import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AcknowledgementStatusBadge } from '../../components/policies/AcknowledgementStatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { policyService } from '../../services/policyService';
import type { Policy } from '../../types';
import { formatPolicyCategory, getPoliciesBasePath } from '../../utils/rbac';

export function MyPoliciesPage() {
  const { user } = useAuth();
  const basePath = user ? getPoliciesBasePath(user.role) : '/employee/policies';
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

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>My Policies</h2>
          <p className="muted">
            Review company policies and acknowledge pending items.
            {pendingCount > 0 ? ` You have ${pendingCount} pending.` : ''}
          </p>
        </div>
        {pendingCount > 0 ? (
          <Link className="btn-primary" to={`${basePath}/pending`}>Pending Acknowledgements</Link>
        ) : null}
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
        <p>Loading policies...</p>
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
