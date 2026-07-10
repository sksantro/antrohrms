import { useEffect, useState } from 'react';

import type { OfferLetterFilters } from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { OFFER_LETTER_STATUS_OPTIONS } from '../../types/offerLetter';
import { formatOfferStatus } from './OfferLetterStatusBadge';
import { DatePicker, Select } from '../ui';

interface OfferLetterFiltersBarProps {
  filters: OfferLetterFilters;
  designations: string[];
  resultCount: number;
  totalCount: number;
  onChange: (filters: OfferLetterFilters) => void;
  onReset: () => void;
}

export function OfferLetterFiltersBar({
  filters,
  designations,
  resultCount,
  totalCount,
  onChange,
  onReset,
}: OfferLetterFiltersBarProps) {
  const update = (field: keyof OfferLetterFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    Boolean(filters.status) ||
    Boolean(filters.department) ||
    Boolean(filters.designation) ||
    Boolean(filters.created_from) ||
    Boolean(filters.created_to);

  return (
    <div className="offer-letter-filters">
      <div className="offer-letter-filters__top">
        <label className="offer-letter-filters__search">
          <span className="offer-letter-filters__search-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            className="offer-letter-filters__search-input"
            placeholder="Search by name, email, or offer ID"
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            aria-label="Search offer letters"
          />
        </label>
        <div className="offer-letter-filters__meta">
          <span className="offer-letter-filters__count">
            Showing {resultCount} of {totalCount}
          </span>
          {hasActiveFilters ? (
            <button type="button" className="offer-letter-filters__reset" onClick={onReset}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="offer-letter-filters__grid">
        <Select
          id="offer_filter_status"
          label="Status"
          value={filters.status}
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">All statuses</option>
          {OFFER_LETTER_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {formatOfferStatus(status)}
            </option>
          ))}
        </Select>

        <Select
          id="offer_filter_department"
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
          id="offer_filter_designation"
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
          id="offer_filter_created_from"
          label="Created From"
          value={filters.created_from}
          onChange={(value) => update('created_from', value)}
          placeholder="Start date"
        />

        <DatePicker
          id="offer_filter_created_to"
          label="Created To"
          value={filters.created_to}
          onChange={(value) => update('created_to', value)}
          placeholder="End date"
        />
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
