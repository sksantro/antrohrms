import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { LeaveStatusBadge } from '../../components/leaves/LeaveStatusBadge';
import { RejectLeaveDialog } from '../../components/leaves/RejectLeaveDialog';
import { Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leaveService } from '../../services/leaveService';
import type { LeaveRequest } from '../../types';
import { formatEmployeeDate } from '../../utils/employeeFilters';
import { getLeavesBasePath } from '../../utils/rbac';

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function LeaveRequestDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user, can } = useAuth();
  const isHrLeaveRoute = location.pathname.startsWith('/hr/leave-management');
  const basePath = isHrLeaveRoute
    ? '/hr/leave-management'
    : user
      ? getLeavesBasePath(user.role, user.department)
      : '/employee/leaves';
  const canApprove = can('can_approve_leaves') && isHrLeaveRoute;
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await leaveService.getRequest(Number(id));
      setRequest(data);
      if (isHrLeaveRoute) {
        const employeeHistory = await leaveService.listRequests({ employee: data.employee });
        setHistory(employeeHistory.filter((item) => item.id !== data.id));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load leave request.');
      setRequest(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isHrLeaveRoute]);

  const handleApprove = async () => {
    if (!request) return;
    setIsActing(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await leaveService.approve(request.id);
      setRequest(updated);
      setSuccess('Leave request approved successfully.');
      setShowApproveConfirm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to approve leave request.');
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!request) return;
    setIsActing(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await leaveService.reject(request.id, { rejection_reason: reason });
      setRequest(updated);
      setSuccess('Leave request rejected.');
      setShowRejectDialog(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reject leave request.');
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <section className="payroll-card">
        <p className="muted">Loading leave request...</p>
      </section>
    );
  }

  if (error && !request) {
    return (
      <section className="payroll-card">
        <p className="form-error">{error}</p>
        <Link to={basePath}>Back</Link>
      </section>
    );
  }

  if (!request) {
    return (
      <section className="payroll-card">
        <p className="form-error">Leave request not found.</p>
        <Link to={basePath}>Back</Link>
      </section>
    );
  }

  return (
    <section className="payroll-card">
      <div className="page-toolbar">
        <div>
          <h2>Leave Request Details</h2>
          <p className="muted">
            {request.employee_name} — {titleCase(request.leave_type)}
          </p>
        </div>
        <div className="table-actions">
          <Link to={basePath}>Back</Link>
          {canApprove && request.status === 'PENDING' ? (
            <>
              <Button type="button" disabled={isActing} onClick={() => setShowApproveConfirm(true)}>
                Approve
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isActing}
                onClick={() => setShowRejectDialog(true)}
              >
                Reject
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <div className="detail-grid">
        <DetailItem label="Employee Name" value={request.employee_name} />
        <DetailItem label="Employee Code" value={request.employee_code} />
        <DetailItem label="Department" value={request.employee_department || '—'} />
        <DetailItem label="Email" value={request.employee_email || '—'} />
        <DetailItem label="Leave Type" value={titleCase(request.leave_type)} />
        <DetailItem label="From Date" value={formatEmployeeDate(request.start_date)} />
        <DetailItem label="To Date" value={formatEmployeeDate(request.end_date)} />
        <DetailItem label="Total Days" value={request.total_working_days} />
        <DetailItem label="Status" value={<LeaveStatusBadge status={request.status} />} />
        <DetailItem label="Applied Date" value={formatEmployeeDate(request.created_at.slice(0, 10))} />
        <DetailItem label="Approved By" value={request.approved_by_name || '—'} />
        <DetailItem label="Rejected By" value={request.rejected_by_name || '—'} />
        <DetailItem label="Reason" value={request.reason || '—'} fullWidth />
        {request.rejection_reason ? (
          <DetailItem label="Rejection Reason" value={request.rejection_reason} fullWidth />
        ) : null}
      </div>

      {isHrLeaveRoute ? (
        <div className="hr-leave-history-block">
          <h3>Employee Leave History</h3>
          {history.length === 0 ? (
            <p className="muted">No additional leave history for this employee.</p>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>{titleCase(item.leave_type)}</td>
                      <td>{formatEmployeeDate(item.start_date)}</td>
                      <td>{formatEmployeeDate(item.end_date)}</td>
                      <td>{item.total_working_days}</td>
                      <td>
                        <LeaveStatusBadge status={item.status} />
                      </td>
                      <td>{formatEmployeeDate(item.created_at.slice(0, 10))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {showApproveConfirm ? (
        <div className="hr-leave-confirm">
          <div className="hr-leave-confirm__card">
            <h3>Confirm Approval</h3>
            <p>Are you sure you want to approve this leave request?</p>
            <div className="hr-leave-confirm__actions">
              <Button
                type="button"
                variant="secondary"
                disabled={isActing}
                onClick={() => setShowApproveConfirm(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={isActing} onClick={() => void handleApprove()}>
                {isActing ? 'Approving...' : 'Confirm Approve'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RejectLeaveDialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onSubmit={handleReject}
      />
    </section>
  );
}

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'detail-item full-width' : 'detail-item'}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
