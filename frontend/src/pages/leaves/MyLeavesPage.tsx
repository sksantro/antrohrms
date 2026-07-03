import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { LeaveBalanceCard } from '../../components/leaves/LeaveBalanceCard';
import { LeaveRequestTable } from '../../components/leaves/LeaveRequestTable';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { leaveService } from '../../services/leaveService';
import type { LeaveBalance, LeaveRequest } from '../../types';
import { getLeavesBasePath } from '../../utils/rbac';

export function MyLeavesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const basePath = user ? getLeavesBasePath(user.role) : '/employee/leaves';
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [balanceData, requestData] = await Promise.all([
        leaveService.getMyBalance(),
        leaveService.getMyRequests(),
      ]);
      setBalance(balanceData);
      setRequests(requestData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load leave data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [location.pathname]);

  const handleCancel = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await leaveService.cancel(id);
      setSuccess('Leave request cancelled successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel leave request.');
    }
  };

  const handleRequestCancellation = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await leaveService.requestCancellation(id);
      setSuccess('Cancellation request submitted for HR approval.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to request cancellation.');
    }
  };

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>My Leave Balance</h2>
          <p className="muted">Unified paid leave wallet with monthly accrual (1 leave/month).</p>
        </div>
        <Link className="btn-primary" to={`${basePath}/apply`}>Apply Leave</Link>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      {isLoading ? <p>Loading...</p> : balance ? <LeaveBalanceCard balance={balance} /> : null}

      <h3 style={{ marginTop: '2rem' }}>My Leave Requests</h3>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <LeaveRequestTable
          requests={requests}
          showEmployee={false}
          showActions
          onCancel={handleCancel}
          onRequestCancellation={handleRequestCancellation}
          detailPath={(id) => `${basePath}/${id}`}
        />
      )}
    </section>
  );
}
