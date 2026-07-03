import { Link } from 'react-router-dom';

import type { Attendance } from '../../types';
import { formatTime, formatWorkMode } from '../../utils/rbac';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';

interface AttendanceTableProps {
  records: Attendance[];
  basePath: string;
  showEmployee?: boolean;
  canManage?: boolean;
}

export function AttendanceTable({
  records,
  basePath,
  showEmployee = true,
  canManage = false,
}: AttendanceTableProps) {
  const rows = Array.isArray(records) ? records : [];

  return (
    <div className="table-wrap">
      <table className="employee-table">
        <thead>
          <tr>
            {showEmployee ? <th>Employee Code</th> : null}
            {showEmployee ? <th>Employee Name</th> : null}
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Work Mode</th>
            <th>Status</th>
            <th>Total Hours</th>
            <th>Late Minutes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showEmployee ? 10 : 8}>No attendance records found.</td>
            </tr>
          ) : (
            rows.map((record) => (
              <tr key={record.id}>
                {showEmployee ? <td>{record.employee_code}</td> : null}
                {showEmployee ? <td>{record.employee_name}</td> : null}
                <td>{record.date}</td>
                <td>{formatTime(record.check_in_time)}</td>
                <td>{formatTime(record.check_out_time)}</td>
                <td>{formatWorkMode(record.work_mode)}</td>
                <td>
                  <AttendanceStatusBadge status={record.status} />
                </td>
                <td>{record.total_work_hours}</td>
                <td>{record.late_minutes}</td>
                <td className="table-actions">
                  <Link to={`${basePath}/${record.id}`}>View</Link>
                  {canManage ? <Link to={`${basePath}/${record.id}/edit`}>Edit</Link> : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
