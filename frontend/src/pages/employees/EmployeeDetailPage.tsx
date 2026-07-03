import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { StatusBadge } from '../../components/employees/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { formatEmploymentType, getEmployeesBasePath } from '../../utils/rbac';

export function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const basePath = user ? getEmployeesBasePath(user.role) : '/admin/employees';
  const canManage = can('can_manage_employees');
  const canDelete = can('can_delete_employees');
  const isBasicView = user?.role === 'FINANCE';

  useEffect(() => {
    const loadEmployee = async () => {
      if (!id) {
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await employeeService.get(Number(id));
        setEmployee(data);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Unable to load employee.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadEmployee();
  }, [id]);

  const handleDelete = async () => {
    if (!employee || !window.confirm(`Delete employee ${employee.employee_code}?`)) {
      return;
    }

    try {
      await employeeService.delete(employee.id);
      navigate(basePath);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to delete employee.';
      setError(message);
    }
  };

  if (isLoading) {
    return (
      <section className="dashboard-card wide">
        <p>Loading employee details...</p>
      </section>
    );
  }

  if (error || !employee) {
    return (
      <section className="dashboard-card wide">
        <p className="form-error">{error ?? 'Employee not found.'}</p>
        <Link to={basePath}>Back to list</Link>
      </section>
    );
  }

  return (
    <section className="dashboard-card wide">
      <div className="page-toolbar">
        <div>
          <h2>{employee.full_name ?? `${employee.first_name} ${employee.last_name}`}</h2>
          <p className="muted">{employee.employee_code}</p>
        </div>
        <div className="toolbar-actions">
          <Link to={basePath}>Back</Link>
          {canManage ? (
            <Link to={`${basePath}/${employee.id}/edit`}>Edit</Link>
          ) : null}
          {canDelete ? (
            <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div className="detail-grid">
        <DetailItem label="Email" value={employee.email} />
        <DetailItem label="Phone" value={employee.phone} />
        {!isBasicView ? (
          <DetailItem label="Alternate Phone" value={employee.alternate_phone || '-'} />
        ) : null}
        <DetailItem label="Department" value={employee.department} />
        <DetailItem label="Designation" value={employee.designation} />
        <DetailItem
          label="Reporting Manager"
          value={
            employee.reporting_manager
              ? `${employee.reporting_manager.first_name} ${employee.reporting_manager.last_name}`
              : employee.reporting_manager_name ?? '-'
          }
        />
        <DetailItem label="Status" value={<StatusBadge status={employee.status} />} />
        {!isBasicView ? (
          <>
            <DetailItem label="Gender" value={employee.gender || '-'} />
            <DetailItem label="Date of Birth" value={employee.date_of_birth || '-'} />
            <DetailItem label="Joining Date" value={employee.joining_date} />
            <DetailItem
              label="Employment Type"
              value={formatEmploymentType(employee.employment_type)}
            />
            <DetailItem label="Work Location" value={employee.work_location || '-'} />
            <DetailItem label="Address" value={employee.address || '-'} fullWidth />
            <DetailItem
              label="Emergency Contact"
              value={employee.emergency_contact_name || '-'}
            />
            <DetailItem
              label="Emergency Phone"
              value={employee.emergency_contact_phone || '-'}
            />
          </>
        ) : null}
      </div>
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
