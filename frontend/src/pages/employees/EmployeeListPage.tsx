import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { PageHeader } from '../../components/PageHeader';
import { EmployeeTable } from '../../components/employees/EmployeeTable';
import { ButtonLink, Card } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { getEmployeesBasePath } from '../../utils/rbac';

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function EmployeeListPage() {
  const { user, can } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const basePath = user ? getEmployeesBasePath(user.role) : '/admin/employees';
  const isBasicView = user?.role === 'FINANCE';
  const canManage = can('can_manage_employees');
  const location = useLocation();

  useEffect(() => {
    const loadEmployees = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await employeeService.list();
        setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Unable to load employees.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadEmployees();
  }, [location.pathname]);

  return (
    <div className="employees-page">
      <Card wide className="employees-page-card employees-page-card--list">
      <PageHeader
        title="Employees"
        description={
          canManage
            ? 'Manage employee records and linked user accounts.'
            : 'View employee records based on your access level.'
        }
        actions={
          canManage ? (
            <ButtonLink to={`${basePath}/new`} className="employees-page__add-button">
              <PlusIcon />
              Add Employee
            </ButtonLink>
          ) : undefined
        }
      />

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? (
        <p className="muted employees-page__loading">Loading employees...</p>
      ) : (
        <EmployeeTable
          employees={employees}
          basePath={basePath}
          canManage={canManage}
          isBasicView={isBasicView}
        />
      )}
      </Card>
    </div>
  );
}
