import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { LeaveRequestTable } from '../../components/leaves/LeaveRequestTable';
import { LeaveStatusBadge } from '../../components/leaves/LeaveStatusBadge';
import { RejectLeaveDialog } from '../../components/leaves/RejectLeaveDialog';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard, KpiGrid } from '../../components/timeleave/KpiCard';
import {
  ApprovedIcon,
  EscalatedIcon,
  InboxIcon,
  PendingIcon,
  RejectedIcon,
  RequestsIcon,
  SpecialIcon,
} from '../../components/timeleave/commandIcons';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leaveService } from '../../services/leaveService';
import type {
  LeaveBalance,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveType,
} from '../../types';
import { getLeavesBasePath } from '../../utils/rbac';

const statusOptions: LeaveRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'CANCELLATION_REQUESTED',
];

const leaveTypeOptions: LeaveType[] = ['CASUAL', 'SICK', 'EMERGENCY', 'PLANNED', 'UNPAID'];

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeaveManagementCommandCenterPage() {
  const { user, can } = useAuth();
  const basePath = user ? getLeavesBasePath(user.role) : '/admin/leaves';
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<LeaveType | ''>('');
  const [search, setSearch] = useState('');

  const canApprove = can('can_approve_leaves');
  const canHr = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN';
  const canManageBalances = can('can_manage_leave_balances');
  const showEmployee = true;

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await leaveService.listRequests({ year });
      setRequests(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load leave requests.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalances = async () => {
    if (!canManageBalances) return;
    try {
      const data = await leaveService.listBalances({ year });
      setBalances(data);
    } catch {
      setBalances([]);
    }
  };

  useEffect(() => {
    void loadRequests();
    void loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const handleApprove = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await leaveService.approve(id);
      setSuccess('Leave request approved successfully.');
      await loadRequests();
      await loadBalances();
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
      await loadRequests();
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
      await loadRequests();
      await loadBalances();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to approve cancellation.');
    }
  };

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
      escalated: requests.filter((r) => r.escalated_to_hr).length,
      special: requests.filter((r) => r.is_special_approval_required).length,
    }),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter && request.status !== statusFilter) return false;
      if (typeFilter && request.leave_type !== typeFilter) return false;
      if (term) {
        const haystack = `${request.employee_name} ${request.employee_code}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, search]);

  const approvalQueue = useMemo(
    () =>
      requests.filter(
        (request) => request.status === 'PENDING' || request.status === 'CANCELLATION_REQUESTED',
      ),
    [requests],
  );

  const escalatedCases = useMemo(() => requests.filter((r) => r.escalated_to_hr), [requests]);
  const specialCases = useMemo(
    () => requests.filter((r) => r.is_special_approval_required),
    [requests],
  );

  return (
    <div className="command-center leave-cc">
      <section className="command-center__panel">
        <PageHeader
          title="Leave Management"
          description="Manage leave requests, approvals, balances, and exceptions."
        />

        <div className="cc-filters">
          <label className="cc-filter">
            <span className="cc-filter__label">Year</span>
            <input
              className="cc-filter__control"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
            />
          </label>
          <label className="cc-filter">
            <span className="cc-filter__label">Status</span>
            <select
              className="cc-filter__control"
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target.value || '') as LeaveRequestStatus | '')}
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="cc-filter">
            <span className="cc-filter__label">Leave Type</span>
            <select
              className="cc-filter__control"
              value={typeFilter}
              onChange={(e) => setTypeFilter((e.target.value || '') as LeaveType | '')}
            >
              <option value="">All types</option>
              {leaveTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="cc-filter cc-filter--grow">
            <span className="cc-filter__label">Employee</span>
            <input
              className="cc-filter__control"
              placeholder="Search by name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </section>

      <KpiGrid>
        <KpiCard label="Total Requests" value={stats.total} tone="purple" icon={<RequestsIcon />} />
        <KpiCard label="Pending Approval" value={stats.pending} tone="amber" icon={<PendingIcon />} />
        <KpiCard label="Approved" value={stats.approved} tone="teal" icon={<ApprovedIcon />} />
        <KpiCard label="Rejected" value={stats.rejected} tone="rose" icon={<RejectedIcon />} />
        <KpiCard label="Escalated" value={stats.escalated} tone="cyan" icon={<EscalatedIcon />} />
        <KpiCard label="Special Approval" value={stats.special} tone="slate" icon={<SpecialIcon />} />
      </KpiGrid>

      <div className="cc-split">
        <section className="command-center__panel">
          <div className="cc-panel__head">
            <div>
              <h3 className="cc-panel__title">Leave Requests</h3>
              <p className="cc-panel__subtitle">All leave requests for {year}.</p>
            </div>
            <span className="cc-count-pill">{filteredRequests.length}</span>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}

          {isLoading ? (
            <p className="muted cc-loading">Loading leave requests...</p>
          ) : filteredRequests.length === 0 ? (
            <div className="cc-empty">
              <span className="cc-empty__icon">
                <InboxIcon />
              </span>
              <p className="cc-empty__title">No leave requests</p>
              <p className="cc-empty__text">Requests matching your filters will appear here.</p>
            </div>
          ) : (
            <LeaveRequestTable
              requests={filteredRequests}
              showEmployee={showEmployee}
              showActions={canApprove || canHr}
              onApprove={canApprove ? handleApprove : undefined}
              onReject={canApprove ? (id) => setRejectId(id) : undefined}
              onApproveCancellation={canHr ? handleApproveCancellation : undefined}
              detailPath={(id) => `${basePath}/${id}`}
            />
          )}
        </section>

        <section className="command-center__panel">
          <div className="cc-panel__head">
            <div>
              <h3 className="cc-panel__title">Approval Queue</h3>
              <p className="cc-panel__subtitle">Requests awaiting your action.</p>
            </div>
            <span className="cc-count-pill">{approvalQueue.length}</span>
          </div>

          {approvalQueue.length === 0 ? (
            <div className="cc-empty">
              <span className="cc-empty__icon">
                <InboxIcon />
              </span>
              <p className="cc-empty__title">Queue is clear</p>
              <p className="cc-empty__text">No leave requests are pending action.</p>
            </div>
          ) : (
            <div className="cc-queue">
              {approvalQueue.map((request) => (
                <article key={request.id} className="cc-queue-item">
                  <div className="cc-queue-item__top">
                    <span className="cc-queue-item__name">{request.employee_name}</span>
                    <LeaveStatusBadge status={request.status} />
                  </div>
                  <div className="cc-queue-item__meta">
                    <span>{titleCase(request.leave_type)}</span>
                    <span>
                      {request.start_date} → {request.end_date}
                    </span>
                  </div>
                  {request.reason ? <p className="cc-queue-item__reason">{request.reason}</p> : null}
                  {canApprove || canHr ? (
                    <div className="cc-queue-item__actions">
                      {request.status === 'PENDING' && canApprove ? (
                        <>
                          <button
                            type="button"
                            className="cc-btn cc-btn--approve"
                            onClick={() => void handleApprove(request.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="cc-btn cc-btn--reject"
                            onClick={() => setRejectId(request.id)}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {request.status === 'CANCELLATION_REQUESTED' && canHr ? (
                        <button
                          type="button"
                          className="cc-btn cc-btn--approve"
                          onClick={() => void handleApproveCancellation(request.id)}
                        >
                          Approve Cancellation
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {canManageBalances ? (
        <section className="command-center__panel">
          <div className="cc-panel__head">
            <div>
              <h3 className="cc-panel__title">Leave Balances</h3>
              <p className="cc-panel__subtitle">Employee paid leave wallets for {year} (accrual 1/month).</p>
            </div>
          </div>
          {balances.length === 0 ? (
            <div className="cc-empty">
              <span className="cc-empty__icon">
                <InboxIcon />
              </span>
              <p className="cc-empty__title">No balances found</p>
              <p className="cc-empty__text">Leave balances will appear here once available.</p>
            </div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
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
                  {balances.map((balance) => (
                    <tr key={balance.id}>
                      <td>
                        {balance.employee_code} - {balance.employee_name}
                      </td>
                      <td>{balance.paid_leave_balance}</td>
                      <td>{balance.paid_leave_earned}</td>
                      <td>{balance.paid_leave_used}</td>
                      <td>{balance.lop_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <div className="cc-split cc-split--even">
        <section className="command-center__panel">
          <div className="cc-panel__head">
            <div>
              <h3 className="cc-panel__title">Escalated Leaves</h3>
              <p className="cc-panel__subtitle">Requests escalated to HR.</p>
            </div>
            <span className="cc-count-pill">{escalatedCases.length}</span>
          </div>
          <CaseList
            cases={escalatedCases}
            basePath={basePath}
            emptyTitle="No escalations"
            emptyText="Escalated leave cases will appear here."
          />
        </section>

        <section className="command-center__panel">
          <div className="cc-panel__head">
            <div>
              <h3 className="cc-panel__title">Special Approval</h3>
              <p className="cc-panel__subtitle">Requests requiring special approval.</p>
            </div>
            <span className="cc-count-pill">{specialCases.length}</span>
          </div>
          <CaseList
            cases={specialCases}
            basePath={basePath}
            emptyTitle="No special cases"
            emptyText="Special approval cases will appear here."
          />
        </section>
      </div>

      <RejectLeaveDialog
        open={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={handleReject}
      />
    </div>
  );
}

interface CaseListProps {
  cases: LeaveRequest[];
  basePath: string;
  emptyTitle: string;
  emptyText: string;
}

function CaseList({ cases, basePath, emptyTitle, emptyText }: CaseListProps) {
  if (cases.length === 0) {
    return (
      <div className="cc-empty">
        <span className="cc-empty__icon">
          <InboxIcon />
        </span>
        <p className="cc-empty__title">{emptyTitle}</p>
        <p className="cc-empty__text">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="cc-queue">
      {cases.map((request) => (
        <Link key={request.id} to={`${basePath}/${request.id}`} className="cc-case-item">
          <div className="cc-queue-item__top">
            <span className="cc-queue-item__name">{request.employee_name}</span>
            <LeaveStatusBadge status={request.status} />
          </div>
          <div className="cc-queue-item__meta">
            <span>{titleCase(request.leave_type)}</span>
            <span>
              {request.start_date} → {request.end_date}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
