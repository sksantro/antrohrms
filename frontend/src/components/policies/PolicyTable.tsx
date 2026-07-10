import { Link } from 'react-router-dom';

import { Badge, Table } from '../ui';
import type { Policy } from '../../types';
import { formatPolicyCategory } from '../../utils/rbac';
import { InboxIcon } from './policyIcons';

interface PolicyTableProps {
  policies: Policy[];
  basePath: string;
  canManage?: boolean;
  onPublish?: (id: number) => void;
  onUnpublish?: (id: number) => void;
  onArchive?: (id: number) => void;
}

export function PolicyTable({
  policies,
  basePath,
  canManage = false,
  onPublish,
  onUnpublish,
  onArchive,
}: PolicyTableProps) {
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
          <th>Policy Title</th>
          <th>Category</th>
          <th>Version</th>
          <th>Applies To</th>
          <th>Effective Date</th>
          <th>Status</th>
          <th>Requires Ack</th>
          <th>Created By</th>
          <th>Updated Date</th>
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
            <td>{policy.applies_to_label}</td>
            <td>{policy.effective_date}</td>
            <td>
              <Badge
                variant={
                  policy.status === 'PUBLISHED'
                    ? 'success'
                    : policy.status === 'DRAFT'
                      ? 'warning'
                      : policy.status === 'UNPUBLISHED'
                        ? 'danger'
                        : 'info'
                }
              >
                {policy.status_label}
              </Badge>
            </td>
            <td>{policy.requires_acknowledgement ? 'Yes' : 'No'}</td>
            <td>{policy.created_by_name || '-'}</td>
            <td>{new Date(policy.updated_at).toLocaleDateString('en-IN')}</td>
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
                {canManage && policy.status === 'DRAFT' && onPublish ? (
                  <button
                    type="button"
                    className="payroll-action"
                    onClick={() => onPublish(policy.id)}
                  >
                    Publish
                  </button>
                ) : null}
                {canManage && policy.status === 'PUBLISHED' && onUnpublish ? (
                  <button
                    type="button"
                    className="payroll-action payroll-action--danger"
                    onClick={() => onUnpublish(policy.id)}
                  >
                    Unpublish
                  </button>
                ) : null}
                {canManage &&
                policy.status !== 'ARCHIVED' &&
                policy.status !== 'PUBLISHED' &&
                onArchive ? (
                  <button
                    type="button"
                    className="payroll-action payroll-action--danger"
                    onClick={() => onArchive(policy.id)}
                  >
                    Archive
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
