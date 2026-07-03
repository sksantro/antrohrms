import { Link } from 'react-router-dom';

import { Badge, Table } from '../ui';
import type { Policy } from '../../types';
import { formatPolicyCategory } from '../../utils/rbac';
import { InboxIcon } from './policyIcons';

interface PolicyTableProps {
  policies: Policy[];
  basePath: string;
  canManage?: boolean;
  onDeactivate?: (id: number) => void;
}

export function PolicyTable({ policies, basePath, canManage = false, onDeactivate }: PolicyTableProps) {
  if (!policies.length) {
    return (
      <div className="cc-empty">
        <span className="cc-empty__icon">
          <InboxIcon />
        </span>
        <p className="cc-empty__title">No policies found</p>
        <p className="cc-empty__text">Published policies will appear here once created.</p>
      </div>
    );
  }

  return (
    <Table className="payroll-table">
      <thead>
        <tr>
          <th>Policy</th>
          <th>Category</th>
          <th>Version</th>
          <th>Effective Date</th>
          <th>Status</th>
          <th>Created By</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => (
          <tr key={policy.id}>
            <td>
              <Link to={`${basePath}/${policy.id}`} className="pol-title-link">
                {policy.title}
              </Link>
            </td>
            <td>
              <Badge variant="info">{formatPolicyCategory(policy.category)}</Badge>
            </td>
            <td>
              <span className="pol-version-pill">v{policy.version}</span>
            </td>
            <td>{policy.effective_date}</td>
            <td>
              <Badge variant={policy.is_active ? 'success' : 'danger'}>
                {policy.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td>{policy.created_by_name || '-'}</td>
            <td>
              <div className="table-actions">
                <Link to={`${basePath}/${policy.id}`} className="payroll-action">
                  View
                </Link>
                {canManage ? (
                  <Link to={`${basePath}/${policy.id}/edit`} className="payroll-action">
                    Edit
                  </Link>
                ) : null}
                {canManage && policy.is_active && onDeactivate ? (
                  <button
                    type="button"
                    className="payroll-action payroll-action--danger"
                    onClick={() => onDeactivate(policy.id)}
                  >
                    Deactivate
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
