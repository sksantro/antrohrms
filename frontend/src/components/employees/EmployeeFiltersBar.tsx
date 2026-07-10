import { useEffect, useState } from 'react';

import type { EmployeeFilterOptions, EmployeeListFilters } from '../../utils/employeeFilters';
import { formatEmploymentType, formatStatus } from '../../utils/rbac';
import { Select } from '../ui';

interface EmployeeFiltersBarProps {
  filters: EmployeeListFilters;
  options: EmployeeFilterOptions;
  resultCount: number;
  totalCount: number;
  onChange: (filters: EmployeeListFilters) => void;
  onReset: () => void;
}

export function EmployeeFiltersBar({
  filters,
  options,
  resultCount,
  totalCount,
  onChange,
  onReset,
}: EmployeeFiltersBarProps) {
  const update = (field: keyof EmployeeListFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    Boolean(filters.department) ||
    Boolean(filters.designation) ||
    Boolean(filters.status) ||
    Boolean(filters.employment_type) ||
    Boolean(filters.work_location);

  return (
    <div className="employee-filters">
      <div className="employee-filters__top">
        <label className="employee-filters__search">
          <span className="employee-filters__search-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            className="employee-filters__search-input"
            placeholder="Search by name, email, phone, or employee code"
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            aria-label="Search employees"
          />
        </label>
        <div className="employee-filters__meta">
          <span className="employee-filters__count">
            Showing {resultCount} of {totalCount}
          </span>
          {hasActiveFilters ? (
            <button type="button" className="employee-filters__reset" onClick={onReset}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="employee-filters__grid">
        <Select
          id="employee_filter_department"
          label="Department"
          value={filters.department}
          onChange={(event) => update('department', event.target.value)}
        >
          <option value="">All departments</option>
          {options.departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </Select>

        <Select
          id="employee_filter_designation"
          label="Designation"
          value={filters.designation}
          onChange={(event) => update('designation', event.target.value)}
        >
          <option value="">All designations</option>
          {options.designations.map((designation) => (
            <option key={designation} value={designation}>
              {designation}
            </option>
          ))}
        </Select>

        <Select
          id="employee_filter_status"
          label="Status"
          value={filters.status}
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">All statuses</option>
          {(['ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED'] as const).map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </Select>

        <Select
          id="employee_filter_employment_type"
          label="Employment Type"
          value={filters.employment_type}
          onChange={(event) => update('employment_type', event.target.value)}
        >
          <option value="">All types</option>
          {(['FULL_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT'] as const).map((type) => (
            <option key={type} value={type}>
              {formatEmploymentType(type)}
            </option>
          ))}
        </Select>

        <Select
          id="employee_filter_work_location"
          label="Work Location"
          value={filters.work_location}
          onChange={(event) => update('work_location', event.target.value)}
        >
          <option value="">All locations</option>
          {options.workLocations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
