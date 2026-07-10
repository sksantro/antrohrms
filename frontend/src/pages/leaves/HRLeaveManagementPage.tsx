import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { LeaveStatusBadge } from '../../components/leaves/LeaveStatusBadge';
import { RejectLeaveDialog } from '../../components/leaves/RejectLeaveDialog';
import { PageHeader } from '../../components/PageHeader';
import { Button, DatePicker, Select, Table } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leaveService } from '../../services/leaveService';
import type {
  LeaveBalance,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveType,
} from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { formatEmployeeDate } from '../../utils/employeeFilters';

const STATUS_OPTIONS: LeaveRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const LEAVE_TYPE_OPTIONS: LeaveType[] = ['CASUAL', 'SICK', 'EMERGENCY', 'PLANNED', 'UNPAID'];

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function HRLeaveManagementPage() {
  const { can } = useAuth();
  const canApprove = can('can_approve_leaves');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<number | null>(null);
  const [historyRequests, setHistoryRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeaveRequestStatus | ''>('');
  const [department, setDepartment] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await leaveService.listRequests({
        search: search.trim() || undefined,
        status,
        department: department || undefined,
        leave_type: leaveType,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setRequests(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load leave requests.');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalances = async () => {
    try {
      const data = await leaveService.listBalances({ year: new Date().getFullYear() });
      setBalances(data);
    } catch {
      setBalances([]);
    }
  };

  useEffect(() => {
    void loadRequests();
    void loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, department, leaveType, dateFrom, dateTo]);

  const employees = useMemo(() => {
    const map = new Map<number, string>();
    requests.forEach((request) => {
      map.set(request.employee, `${request.employee_name} (${request.employee_code})`);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!employeeFilter) return requests;
    return requests.filter((request) => String(request.employee) === employeeFilter);
  }, [requests, employeeFilter]);

  const stats = useMemo(
    () => ({
      total: filteredRequests.length,
      pending: filteredRequests.filter((item) => item.status === 'PENDING').length,
      approved: filteredRequests.filter((item) => item.status === 'APPROVED').length,
      rejected: filteredRequests.filter((item) => item.status === 'REJECTED').length,
    }),
    [filteredRequests],
  );

  const handleApprove = async (id: number) => {
    setIsActing(true);
    setError(null);
    setSuccess(null);
    try {
      await leaveService.approve(id);
      setSuccess('Leave request approved successfully.');
      setApproveId(null);
      await loadRequests();
      await loadBalances();
      if (historyEmployeeId) {
        const history = await leaveService.listRequests({ employee: historyEmployeeId });
        setHistoryRequests(history);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to approve leave request.');
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectId) return;
    setIsActing(true);
    setError(null);
    setSuccess(null);
    try {
      await leaveService.reject(rejectId, { rejection_reason: reason });
      setSuccess('Leave request rejected.');
      setRejectId(null);
      await loadRequests();
      if (historyEmployeeId) {
        const history = await leaveService.listRequests({ employee: historyEmployeeId });
        setHistoryRequests(history);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reject leave request.');
    } finally {
      setIsActing(false);
    }
  };

  const openHistory = async (employeeId: number) => {
    setHistoryEmployeeId(employeeId);
    setError(null);
    try {
      const history = await leaveService.listRequests({ employee: employeeId });
      setHistoryRequests(history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load employee leave history.');
      setHistoryRequests([]);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setDepartment('');
    setLeaveType('');
    setDateFrom('');
    setDateTo('');
    setEmployeeFilter('');
  };

  return (
    <div className="hr-leave-page">
      <section className="payroll-card">
        <PageHeader
          title="Leave Management"
          description="Review, approve, and reject employee leave requests. Attendance regularization remains with Super Admin."
        />

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <div className="hr-leave-kpis">
          <article className="hr-leave-kpi">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="hr-leave-kpi">
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </article>
          <article className="hr-leave-kpi">
            <span>Approved</span>
            <strong>{stats.approved}</strong>
          </article>
          <article className="hr-leave-kpi">
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
          </article>
        </div>

        <div className="offer-letter-filters">
          <div className="offer-letter-filters__top">
            <label className="offer-letter-filters__search">
              <input
                type="search"
                className="offer-letter-filters__search-input"
                placeholder="Search name, email, employee code, department"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search leave requests"
              />
            </label>
            <button type="button" className="offer-letter-filters__reset" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
          <div className="offer-letter-filters__grid">
            <Select
              id="hr_leave_status"
              label="Status"
              value={status}
              onChange={(event) => setStatus((event.target.value || '') as LeaveRequestStatus | '')}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
            <Select
              id="hr_leave_department"
              label="Department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option value="">All departments</option>
              {EMPLOYEE_DEPARTMENTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select
              id="hr_leave_type"
              label="Leave Type"
              value={leaveType}
              onChange={(event) => setLeaveType((event.target.value || '') as LeaveType | '')}
            >
              <option value="">All leave types</option>
              {LEAVE_TYPE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
            <Select
              id="hr_leave_employee"
              label="Employee"
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
            >
              <option value="">All employees</option>
              {employees.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <DatePicker id="hr_leave_from" label="From Date" value={dateFrom} onChange={setDateFrom} />
            <DatePicker id="hr_leave_to" label="To Date" value={dateTo} onChange={setDateTo} />
          </div>
        </div>

        {isLoading ? (
          <div className="hr-leave-loading">
            <span className="employees-page__loading-spinner" aria-hidden />
            <p>Loading leave requests...</p>
          </div>
        ) : (
          <Table className="hr-leave-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Employee Code</th>
                <th>Department</th>
                <th>Leave Type</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Total Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Applied Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="hr-leave-empty">
                      <strong>No leave requests found</strong>
                      <span>Try adjusting filters or search criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.employee_name}</td>
                    <td>{request.employee_code}</td>
                    <td>{request.employee_department || '—'}</td>
                    <td>{titleCase(request.leave_type)}</td>
                    <td>{formatEmployeeDate(request.start_date)}</td>
                    <td>{formatEmployeeDate(request.end_date)}</td>
                    <td>{request.total_working_days}</td>
                    <td className="hr-leave-reason">{request.reason || '—'}</td>
                    <td>
                      <LeaveStatusBadge status={request.status} />
                    </td>
                    <td>{formatEmployeeDate(request.created_at.slice(0, 10))}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/hr/leave-management/${request.id}`}>View</Link>
                        <button type="button" className="payroll-action" onClick={() => void openHistory(request.employee)}>
                          History
                        </button>
                        {canApprove && request.status === 'PENDING' ? (
                          <>
                            <button
                              type="button"
                              className="payroll-action"
                              disabled={isActing}
                              onClick={() => setApproveId(request.id)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="payroll-action payroll-action--danger"
                              disabled={isActing}
                              onClick={() => setRejectId(request.id)}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </section>

      {balances.length > 0 ? (
        <section className="payroll-card">
          <PageHeader
            title="Leave Balance Summary"
            description={`Paid leave wallets for ${new Date().getFullYear()}.`}
          />
          <Table>
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
                    {balance.employee_code} — {balance.employee_name}
                  </td>
                  <td>{balance.paid_leave_balance}</td>
                  <td>{balance.paid_leave_earned}</td>
                  <td>{balance.paid_leave_used}</td>
                  <td>{balance.lop_days}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      ) : null}

      {historyEmployeeId ? (
        <section className="payroll-card">
          <div className="hr-leave-history-head">
            <PageHeader
              title="Employee Leave History"
              description="Previous leave requests for the selected employee."
            />
            <Button type="button" variant="secondary" onClick={() => setHistoryEmployeeId(null)}>
              Close History
            </Button>
          </div>
          {historyRequests.length === 0 ? (
            <p className="muted">No leave history found for this employee.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {historyRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{titleCase(request.leave_type)}</td>
                    <td>{formatEmployeeDate(request.start_date)}</td>
                    <td>{formatEmployeeDate(request.end_date)}</td>
                    <td>{request.total_working_days}</td>
                    <td>
                      <LeaveStatusBadge status={request.status} />
                    </td>
                    <td>{formatEmployeeDate(request.created_at.slice(0, 10))}</td>
                    <td>
                      <Link to={`/hr/leave-management/${request.id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      ) : null}

      {approveId !== null ? (
        <div className="hr-leave-confirm">
          <div className="hr-leave-confirm__card">
            <h3>Confirm Approval</h3>
            <p>Are you sure you want to approve this leave request?</p>
            <div className="hr-leave-confirm__actions">
              <Button type="button" variant="secondary" disabled={isActing} onClick={() => setApproveId(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={isActing} onClick={() => void handleApprove(approveId)}>
                {isActing ? 'Approving...' : 'Confirm Approve'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RejectLeaveDialog
        open={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={handleReject}
      />
    </div>
  );
}
