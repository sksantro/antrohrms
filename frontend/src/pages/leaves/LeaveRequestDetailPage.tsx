import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { LeaveStatusBadge } from '../../components/leaves/LeaveStatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leaveService } from '../../services/leaveService';
import type { LeaveRequest } from '../../types';
import { getLeavesBasePath } from '../../utils/rbac';

export function LeaveRequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const basePath = user ? getLeavesBasePath(user.role) : '/employee/leaves';
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await leaveService.getRequest(Number(id));
        setRequest(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load leave request.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id]);

  if (isLoading) return <section className="dashboard-card wide"><p>Loading...</p></section>;
  if (error || !request) {
    return (
      <section className="dashboard-card wide">
        <p className="form-error">{error ?? 'Leave request not found.'}</p>
        <Link to={basePath}>Back</Link>
      </section>
    );
  }

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>Leave Request Details</h2>
          <p className="muted">{request.employee_name} — {request.leave_type}</p>
        </div>
        <Link to={basePath}>Back</Link>
      </div>

      <div className="detail-grid">
        <DetailItem label="Employee Code" value={request.employee_code} />
        <DetailItem label="Leave Type" value={request.leave_type} />
        <DetailItem label="Start Date" value={request.start_date} />
        <DetailItem label="End Date" value={request.end_date} />
        <DetailItem label="Working Days" value={request.total_working_days} />
        <DetailItem label="Paid Leave Days" value={request.paid_leave_days} />
        <DetailItem label="LOP Days" value={request.lop_days} />
        <DetailItem label="Half Day" value={request.half_day ? 'Yes' : 'No'} />
        {request.half_day ? <DetailItem label="Session" value={request.half_day_session || '-'} /> : null}
        <DetailItem label="Status" value={<LeaveStatusBadge status={request.status} />} />
        <DetailItem label="Special Approval" value={request.is_special_approval_required ? 'Required' : 'No'} />
        <DetailItem label="Escalated" value={request.escalated_to_hr ? 'Yes' : 'No'} />
        <DetailItem label="Pending Days" value={String(request.pending_days)} />
        <DetailItem label="Approved By" value={request.approved_by_name || '-'} />
        <DetailItem label="Reason" value={request.reason} fullWidth />
        {request.rejection_reason ? (
          <DetailItem label="Rejection Reason" value={request.rejection_reason} fullWidth />
        ) : null}
      </div>
    </section>
  );
}

function DetailItem({ label, value, fullWidth = false }: { label: string; value: ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'detail-item full-width' : 'detail-item'}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
