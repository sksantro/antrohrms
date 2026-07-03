import type { LeaveBalance } from '../../types';

export function LeaveBalanceCard({ balance }: { balance: LeaveBalance }) {
  return (
    <div className="summary-grid">
      <div className="summary-card">
        <span className="detail-label">Paid Leave Balance</span>
        <strong>{balance.paid_leave_balance}</strong>
      </div>
      <div className="summary-card">
        <span className="detail-label">Earned ({balance.year})</span>
        <strong>{balance.paid_leave_earned}</strong>
      </div>
      <div className="summary-card">
        <span className="detail-label">Used</span>
        <strong>{balance.paid_leave_used}</strong>
      </div>
      <div className="summary-card">
        <span className="detail-label">LOP Days</span>
        <strong>{balance.lop_days}</strong>
      </div>
    </div>
  );
}
