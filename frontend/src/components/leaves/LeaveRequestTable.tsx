import { Link } from 'react-router-dom';

import type { LeaveRequest } from '../../types';
import { LeaveStatusBadge } from './LeaveStatusBadge';

interface LeaveRequestTableProps {
  requests: LeaveRequest[];
  showEmployee?: boolean;
  showActions?: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onCancel?: (id: number) => void;
  onRequestCancellation?: (id: number) => void;
  onApproveCancellation?: (id: number) => void;
  detailPath?: (id: number) => string;
}

export function LeaveRequestTable({
  requests,
  showEmployee = true,
  showActions = false,
  onApprove,
  onReject,
  onCancel,
  onRequestCancellation,
  onApproveCancellation,
  detailPath,
}: LeaveRequestTableProps) {
  if (!requests.length) {
    return <p className="muted">No leave requests found.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {showEmployee ? <th>Employee Code</th> : null}
            {showEmployee ? <th>Employee Name</th> : null}
            <th>Leave Type</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Working Days</th>
            <th>Paid Days</th>
            <th>LOP Days</th>
            <th>Status</th>
            <th>Special</th>
            <th>Escalated</th>
            <th>Approved By</th>
            {showActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              {showEmployee ? <td>{request.employee_code}</td> : null}
              {showEmployee ? <td>{request.employee_name}</td> : null}
              <td>{request.leave_type}</td>
              <td>{request.start_date}</td>
              <td>{request.end_date}</td>
              <td>{request.total_working_days}</td>
              <td>{request.paid_leave_days}</td>
              <td>{request.lop_days}</td>
              <td><LeaveStatusBadge status={request.status} /></td>
              <td>{request.is_special_approval_required ? 'Yes' : 'No'}</td>
              <td>{request.escalated_to_hr ? 'Yes' : 'No'}</td>
              <td>{request.approved_by_name || '-'}</td>
              {showActions ? (
                <td>
                  <div className="table-actions">
                    {detailPath ? <Link to={detailPath(request.id)}>View</Link> : null}
                    {request.status === 'PENDING' && onApprove ? (
                      <button type="button" onClick={() => onApprove(request.id)}>Approve</button>
                    ) : null}
                    {request.status === 'PENDING' && onReject ? (
                      <button type="button" className="btn-secondary" onClick={() => onReject(request.id)}>
                        Reject
                      </button>
                    ) : null}
                    {request.status === 'PENDING' && onCancel ? (
                      <button type="button" className="btn-secondary" onClick={() => onCancel(request.id)}>
                        Cancel
                      </button>
                    ) : null}
                    {request.status === 'APPROVED' && onRequestCancellation ? (
                      <button type="button" className="btn-secondary" onClick={() => onRequestCancellation(request.id)}>
                        Request Cancel
                      </button>
                    ) : null}
                    {request.status === 'CANCELLATION_REQUESTED' && onApproveCancellation ? (
                      <button type="button" onClick={() => onApproveCancellation(request.id)}>
                        Approve Cancel
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
