import { Link } from 'react-router-dom';

import { Table } from '../ui';
import type { Employee } from '../../types';
import { StatusBadge } from './StatusBadge';

interface EmployeeTableProps {
  employees: Employee[];
  basePath: string;
  canManage?: boolean;
  isBasicView?: boolean;
}

export function EmployeeTable({
  employees,
  basePath,
  canManage = false,
  isBasicView = false,
}: EmployeeTableProps) {
  const rows = Array.isArray(employees) ? employees : [];

  const getInitials = (employee: Employee) => {
    const source = employee.full_name ?? `${employee.first_name} ${employee.last_name}`;
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  };

  return (
    <Table className="employees-table-wrap">
      <thead>
        <tr>
          <th>Employee Code</th>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Department</th>
          <th>Designation</th>
          {!isBasicView ? <th>Reporting Manager</th> : null}
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={isBasicView ? 8 : 9} className="employees-table__empty">
              No employees found.
            </td>
          </tr>
        ) : (
          rows.map((employee) => (
            <tr key={employee.id}>
              <td>
                <span className="employees-table__code">{employee.employee_code}</span>
              </td>
              <td>
                <div className="employees-table__person">
                  <span className="employees-table__avatar">{getInitials(employee)}</span>
                  <span className="employees-table__name">
                    {employee.full_name ?? `${employee.first_name} ${employee.last_name}`}
                  </span>
                </div>
              </td>
              <td>
                <span className="employees-table__email">{employee.email}</span>
              </td>
              <td>{employee.phone}</td>
              <td>{employee.department}</td>
              <td>{employee.designation}</td>
              {!isBasicView ? (
                <td>
                  {employee.reporting_manager
                    ? `${employee.reporting_manager.first_name} ${employee.reporting_manager.last_name}`
                    : employee.reporting_manager_name ?? '-'}
                </td>
              ) : null}
              <td>
                <StatusBadge status={employee.status} />
              </td>
              <td>
                <div className="employees-table__actions">
                  <Link to={`${basePath}/${employee.id}`} className="employees-table__action">
                    View
                  </Link>
                  {canManage ? (
                    <Link to={`${basePath}/${employee.id}/edit`} className="employees-table__action">
                      Edit
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
