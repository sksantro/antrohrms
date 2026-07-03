import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AcknowledgementStatusBadge } from '../../components/policies/AcknowledgementStatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { policyService } from '../../services/policyService';
import type { Policy } from '../../types';
import { formatPolicyCategory, getPoliciesBasePath } from '../../utils/rbac';

export function PendingAcknowledgementsPage() {
  const { user } = useAuth();
  const basePath = user ? getPoliciesBasePath(user.role) : '/employee/policies';
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await policyService.getMy('PENDING');
        setPolicies(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load pending policies.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>Pending Acknowledgements</h2>
          <p className="muted">Policies that require your acknowledgement.</p>
        </div>
        <Link to={basePath}>My Policies</Link>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? (
        <p>Loading...</p>
      ) : !policies.length ? (
        <p className="form-success">You have no pending policy acknowledgements.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Version</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td>{policy.title}</td>
                  <td>{formatPolicyCategory(policy.category)}</td>
                  <td>{policy.version}</td>
                  <td>
                    {policy.acknowledgement_status ? (
                      <AcknowledgementStatusBadge status={policy.acknowledgement_status} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <Link to={`${basePath}/${policy.id}`}>Open & Acknowledge</Link>
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
