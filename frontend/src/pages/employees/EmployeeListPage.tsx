import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { PageHeader } from '../../components/PageHeader';
import {
  EmployeeFiltersBar,
  useDebouncedValue,
} from '../../components/employees/EmployeeFiltersBar';
import { EmployeeTable } from '../../components/employees/EmployeeTable';
import { ButtonLink, Card } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import {
  buildEmployeeFilterOptions,
  emptyEmployeeListFilters,
  filterEmployees,
} from '../../utils/employeeFilters';
import { canManageEmployeeRecords, getEmployeesBasePath, isHrEmployeesRoute } from '../../utils/rbac';

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
  const [filters, setFilters] = useState(emptyEmployeeListFilters);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebouncedValue(filters.search);

  const location = useLocation();
  const basePath = user ? getEmployeesBasePath(user.role, user.department) : '/admin/employees';
  const isHrWorkspace = isHrEmployeesRoute(location.pathname);
  const isBasicView = user?.role === 'FINANCE';
  const canManage = canManageEmployeeRecords(can, location.pathname);

  const activeFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const filterOptions = useMemo(() => buildEmployeeFilterOptions(employees), [employees]);

  const filteredEmployees = useMemo(
    () => filterEmployees(employees, activeFilters),
    [employees, activeFilters],
  );

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
        setEmployees([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadEmployees();
  }, [location.pathname]);

  return (
    <div className={`employees-page${isHrWorkspace ? ' employees-page--hr' : ''}`}>
      <Card wide className="employees-page-card employees-page-card--list">
        <PageHeader
          title={isHrWorkspace ? 'Employee Management' : 'Employees'}
          description={
            isHrWorkspace
              ? 'Manage employee records, company details, and employment status.'
              : canManage
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

        {error ? <p className="form-error employees-page__error">{error}</p> : null}

        <EmployeeFiltersBar
          filters={filters}
          options={filterOptions}
          resultCount={filteredEmployees.length}
          totalCount={employees.length}
          onChange={setFilters}
          onReset={() => setFilters(emptyEmployeeListFilters)}
        />

        {isLoading ? (
          <div className="employees-page__loading-state">
            <span className="employees-page__loading-spinner" aria-hidden />
            <p>Loading employees...</p>
          </div>
        ) : (
          <EmployeeTable
            employees={filteredEmployees}
            basePath={basePath}
            canManage={canManage}
            isBasicView={isBasicView}
          />
        )}
      </Card>
    </div>
  );
}
