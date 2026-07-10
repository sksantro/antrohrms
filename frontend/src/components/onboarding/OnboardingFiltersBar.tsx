import { useEffect, useState } from 'react';

import type { OnboardingFilters } from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { ONBOARDING_STATUS_OPTIONS } from '../../types/onboarding';
import { DatePicker, Select } from '../ui';

interface OnboardingFiltersBarProps {
  filters: OnboardingFilters;
  designations: string[];
  resultCount: number;
  totalCount: number;
  onChange: (filters: OnboardingFilters) => void;
  onReset: () => void;
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function OnboardingFiltersBar({
  filters,
  designations,
  resultCount,
  totalCount,
  onChange,
  onReset,
}: OnboardingFiltersBarProps) {
  const update = (field: keyof OnboardingFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    Boolean(filters.status) ||
    Boolean(filters.department) ||
    Boolean(filters.designation) ||
    Boolean(filters.joining_from) ||
    Boolean(filters.joining_to);

  return (
    <div className="onboarding-filters">
      <div className="onboarding-filters__top">
        <label className="onboarding-filters__search">
          <span className="onboarding-filters__search-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            className="onboarding-filters__search-input"
            placeholder="Search name, email, phone, employee code"
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            aria-label="Search onboarding records"
          />
        </label>
        <div className="onboarding-filters__meta">
          <span className="onboarding-filters__count">
            Showing {resultCount} of {totalCount}
          </span>
          {hasActiveFilters ? (
            <button type="button" className="onboarding-filters__reset" onClick={onReset}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="onboarding-filters__grid">
        <Select
          id="onboarding_filter_status"
          label="Status"
          value={filters.status}
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">All statuses</option>
          {ONBOARDING_STATUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>

        <Select
          id="onboarding_filter_department"
          label="Department"
          value={filters.department}
          onChange={(event) => update('department', event.target.value)}
        >
          <option value="">All departments</option>
          {EMPLOYEE_DEPARTMENTS.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </Select>

        <Select
          id="onboarding_filter_designation"
          label="Designation"
          value={filters.designation}
          onChange={(event) => update('designation', event.target.value)}
        >
          <option value="">All designations</option>
          {designations.map((designation) => (
            <option key={designation} value={designation}>
              {designation}
            </option>
          ))}
        </Select>

        <DatePicker
          id="onboarding_filter_joining_from"
          label="Joining From"
          value={filters.joining_from}
          onChange={(value) => update('joining_from', value)}
        />

        <DatePicker
          id="onboarding_filter_joining_to"
          label="Joining To"
          value={filters.joining_to}
          onChange={(value) => update('joining_to', value)}
        />
      </div>
    </div>
  );
}
