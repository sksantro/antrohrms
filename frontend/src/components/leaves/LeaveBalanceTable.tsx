import type { LeaveBalance } from '../../types';

export function LeaveBalanceTable({ balances }: { balances: LeaveBalance[] }) {
  if (!balances.length) {
    return <p className="muted">No leave balances found.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Employee Code</th>
            <th>Employee Name</th>
            <th>Year</th>
            <th>Balance</th>
            <th>Earned</th>
            <th>Used</th>
            <th>LOP Days</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((balance) => (
            <tr key={balance.id}>
              <td>{balance.employee_code}</td>
              <td>{balance.employee_name}</td>
              <td>{balance.year}</td>
              <td>{balance.paid_leave_balance}</td>
              <td>{balance.paid_leave_earned}</td>
              <td>{balance.paid_leave_used}</td>
              <td>{balance.lop_days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
