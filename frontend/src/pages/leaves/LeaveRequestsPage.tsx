import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { LeaveRequestTable } from '../../components/leaves/LeaveRequestTable';
import { RejectLeaveDialog } from '../../components/leaves/RejectLeaveDialog';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leaveService } from '../../services/leaveService';
import type { LeaveBalance, LeaveRequest, LeaveRequestFilters, LeaveRequestStatus } from '../../types';
import { getLeavesBasePath } from '../../utils/rbac';

const statusOptions: LeaveRequestStatus[] = [
  'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CANCELLATION_REQUESTED',
];

interface LeaveRequestsPageProps {
  approvalMode?: boolean;
  escalatedOnly?: boolean;
  specialOnly?: boolean;
}

export function LeaveRequestsPage({
  approvalMode = false,
  escalatedOnly = false,
  specialOnly = false,
}: LeaveRequestsPageProps) {
  const { user, can } = useAuth();
  const location = useLocation();
  const basePath = user ? getLeavesBasePath(user.role) : '/admin/leaves';
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [filters, setFilters] = useState<LeaveRequestFilters>({
    status: approvalMode ? 'PENDING' : '',
    year: new Date().getFullYear(),
    escalated: escalatedOnly,
    special_approval: specialOnly,
  });

  const canApprove = can('can_approve_leaves');
  const canHr = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN';
  const showEmployee = can('can_view_all_leaves') || can('can_view_team_leaves') || user?.role === 'FINANCE';

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await leaveService.listRequests(filters);
      setRequests(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load leave requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [location.pathname, filters]);

  const handleApprove = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await leaveService.approve(id);
      setSuccess('Leave request approved successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to approve leave request.');
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectId) return;
    setError(null);
    setSuccess(null);
    try {
      await leaveService.reject(rejectId, { rejection_reason: reason });
      setSuccess('Leave request rejected.');
      setRejectId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reject leave request.');
    }
  };

  const handleApproveCancellation = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await leaveService.approveCancellation(id);
      setSuccess('Leave cancellation approved and balance restored.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to approve cancellation.');
    }
  };

  const title = escalatedOnly
    ? 'Escalated Leave Requests'
    : specialOnly
      ? 'Special Approval Requests'
      : approvalMode
        ? 'Leave Approval'
        : 'All Leave Requests';

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>{title}</h2>
          <p className="muted">Review and manage leave requests.</p>
        </div>
      </div>

      <div className="filter-bar">
        <select
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, status: (e.target.value || '') as LeaveRequestStatus | '' })
          }
        >
          <option value="">All Statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Year"
          value={filters.year ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, year: e.target.value ? Number(e.target.value) : '' })
          }
        />
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      {isLoading ? (
        <p>Loading leave requests...</p>
      ) : (
        <LeaveRequestTable
          requests={requests}
          showEmployee={showEmployee}
          showActions={canApprove || canHr}
          onApprove={canApprove ? handleApprove : undefined}
          onReject={canApprove ? (id) => setRejectId(id) : undefined}
          onApproveCancellation={canHr ? handleApproveCancellation : undefined}
          detailPath={(id) => `${basePath}/${id}`}
        />
      )}

      <RejectLeaveDialog
        open={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={handleReject}
      />
    </section>
  );
}

export function LeaveBalanceManagementPage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await leaveService.listBalances({ year });
        setBalances(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load balances.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [year]);

  return (
    <section className="dashboard-card wide">
      <h2>Leave Balance Management</h2>
      <p className="muted">View employee paid leave wallets. Accrual is automatic (1/month).</p>
      <div className="filter-bar">
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p>Loading...</p> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Balance</th>
                <th>Earned</th>
                <th>Used</th>
                <th>LOP Days</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id}>
                  <td>{b.employee_code} - {b.employee_name}</td>
                  <td>{b.paid_leave_balance}</td>
                  <td>{b.paid_leave_earned}</td>
                  <td>{b.paid_leave_used}</td>
                  <td>{b.lop_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
