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
          <th>Employee Name</th>
          <th>Email</th>
          <th>Department</th>
          <th>Policy Name</th>
          <th>Policy Version</th>
          <th>Status</th>
          <th>Acknowledged Date</th>
          <th>Proof / Action</th>
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
            <td>{record.employee_email}</td>
            <td>{record.employee_department}</td>
            <td>
              <div className="payroll-emp">
                <span className="payroll-emp__name">{record.policy_title}</span>
              </div>
            </td>
            <td>
              <span className="pol-version-pill">v{record.policy_version}</span>
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
            <td>
              {record.status === 'ACKNOWLEDGED' ? (
                <span className="pol-proof-ref">{record.proof_reference}</span>
              ) : (
                <span className="muted">Pending acknowledgement</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
