import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { StatusBadge } from '../../components/employees/StatusBadge';
import { Card } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { formatEmployeeDate } from '../../utils/employeeFilters';
import {
  canManageEmployeeRecords,
  formatEmploymentType,
  getEmployeesBasePath,
  isHrEmployeesRoute,
} from '../../utils/rbac';

export function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, can } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const basePath = user ? getEmployeesBasePath(user.role, user.department) : '/admin/employees';
  const isHrWorkspace = isHrEmployeesRoute(location.pathname);
  const canManage = canManageEmployeeRecords(can, location.pathname);
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
      <Card wide className="employees-page-card employees-detail-card">
        <div className="employees-page__loading-state">
          <span className="employees-page__loading-spinner" aria-hidden />
          <p>Loading employee details...</p>
        </div>
      </Card>
    );
  }

  if (error || !employee) {
    return (
      <Card wide className="employees-page-card employees-detail-card">
        <p className="form-error">{error ?? 'Employee not found.'}</p>
        <Link to={basePath} className="employees-detail-card__back">
          Back to employees
        </Link>
      </Card>
    );
  }

  const displayName = employee.full_name ?? `${employee.first_name} ${employee.last_name}`;

  return (
    <div className={`employees-page${isHrWorkspace ? ' employees-page--hr' : ''}`}>
      <Card wide className="employees-page-card employees-detail-card">
        <div className="employees-detail-card__header">
          <div>
            <span className="employees-detail-card__code">{employee.employee_code}</span>
            <h2 className="employees-detail-card__title">{displayName}</h2>
            <p className="employees-detail-card__subtitle">
              {employee.designation} · {employee.department}
            </p>
          </div>
          <div className="employees-detail-card__actions">
            <Link to={basePath} className="employees-detail-card__action">
              Back
            </Link>
            {canManage ? (
              <Link to={`${basePath}/${employee.id}/edit`} className="employees-detail-card__action employees-detail-card__action--primary">
                Edit
              </Link>
            ) : null}
            {canDelete ? (
              <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <div className="employees-detail-card__status">
          <StatusBadge status={employee.status} />
        </div>

        <div className="detail-grid employees-detail-grid">
          <DetailItem label="Email" value={employee.email} />
          <DetailItem label="Phone" value={employee.phone} />
          <DetailItem label="Department" value={employee.department} />
          <DetailItem label="Designation" value={employee.designation} />
          <DetailItem
            label="Reporting Manager"
            value={
              employee.reporting_manager
                ? `${employee.reporting_manager.first_name} ${employee.reporting_manager.last_name}`
                : employee.reporting_manager_name ?? '—'
            }
          />
          <DetailItem label="Joining Date" value={formatEmployeeDate(employee.joining_date)} />
          <DetailItem
            label="Employment Type"
            value={formatEmploymentType(employee.employment_type)}
          />
          <DetailItem label="Work Location" value={employee.work_location || '—'} />

          {!isHrWorkspace && !isBasicView ? (
            <>
              <DetailItem label="Alternate Phone" value={employee.alternate_phone || '—'} />
              <DetailItem label="Gender" value={employee.gender || '—'} />
              <DetailItem label="Date of Birth" value={formatEmployeeDate(employee.date_of_birth)} />
              <DetailItem label="Address" value={employee.address || '—'} fullWidth />
              <DetailItem
                label="Emergency Contact"
                value={employee.emergency_contact_name || '—'}
              />
              <DetailItem
                label="Emergency Phone"
                value={employee.emergency_contact_phone || '—'}
              />
            </>
          ) : null}
        </div>
      </Card>
    </div>
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
