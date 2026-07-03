import type { PolicyAcknowledgement } from '../../types';
import { Table } from '../ui';
import { AcknowledgementStatusBadge } from './AcknowledgementStatusBadge';
import { InboxIcon } from './policyIcons';

export function AcknowledgementTable({ records }: { records: PolicyAcknowledgement[] }) {
  if (!records.length) {
    return (
      <div className="cc-empty">
        <span className="cc-empty__icon">
          <InboxIcon />
        </span>
        <p className="cc-empty__title">No acknowledgement records</p>
        <p className="cc-empty__text">Records will appear as employees acknowledge policies.</p>
      </div>
    );
  }

  return (
    <Table className="payroll-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Policy</th>
          <th>Status</th>
          <th>Acknowledged At</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <tr key={record.id}>
            <td>
              <div className="payroll-emp">
                <span className="payroll-emp__code">{record.employee_code}</span>
                <span className="payroll-emp__name">{record.employee_name}</span>
              </div>
            </td>
            <td>
              <div className="payroll-emp">
                <span className="payroll-emp__code">{record.policy_title}</span>
                <span className="payroll-emp__name">v{record.policy_version}</span>
              </div>
            </td>
            <td>
              <AcknowledgementStatusBadge status={record.status} />
            </td>
            <td>
              {record.acknowledged_at ? (
                new Date(record.acknowledged_at).toLocaleString('en-IN')
              ) : (
                <span className="muted">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
