import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../../components/PageHeader';
import {
  OnboardingFiltersBar,
  useDebouncedValue,
} from '../../components/onboarding/OnboardingFiltersBar';
import {
  DocumentsStatusBadge,
  OnboardingStatusBadge,
} from '../../components/onboarding/OnboardingStatusBadge';
import { ButtonLink, Card, Table } from '../../components/ui';
import { ApiError } from '../../services/api';
import { onboardingService } from '../../services/onboardingService';
import type { OnboardingRecord } from '../../types';
import { emptyOnboardingFilters } from '../../types/onboarding';
import { formatEmployeeDate } from '../../utils/employeeFilters';

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function OnboardingListPage() {
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [filters, setFilters] = useState(emptyOnboardingFilters);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebouncedValue(filters.search);

  const activeFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const designations = useMemo(
    () =>
      Array.from(new Set(records.map((record) => record.designation).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [records],
  );

  useEffect(() => {
    async function loadRecords() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await onboardingService.list(activeFilters);
        setRecords(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load onboarding records.');
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRecords();
  }, [activeFilters]);

  return (
    <div className="onboarding-page">
      <Card wide className="onboarding-page__card">
        <PageHeader
          title="Employee Onboarding"
          description="Manage onboarding invites, document collection, and completion reviews."
          actions={
            <ButtonLink to="/hr/onboarding/new" className="onboarding-page__add-button">
              <PlusIcon />
              Create Onboarding
            </ButtonLink>
          }
        />

        {error ? <p className="form-error onboarding-page__error">{error}</p> : null}

        <OnboardingFiltersBar
          filters={filters}
          designations={designations}
          resultCount={records.length}
          totalCount={records.length}
          onChange={setFilters}
          onReset={() => setFilters(emptyOnboardingFilters)}
        />

        {isLoading ? (
          <div className="onboarding-page__loading">
            <span className="employees-page__loading-spinner" aria-hidden />
            <p>Loading onboarding records...</p>
          </div>
        ) : (
          <Table className="onboarding-table-wrap">
            <thead>
              <tr>
                <th>Employee / Candidate</th>
                <th>Email</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Joining Date</th>
                <th>Onboarding Status</th>
                <th>Documents</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="onboarding-table__empty">
                    <div className="onboarding-table__empty-state">
                      <strong>No onboarding records found</strong>
                      <span>Create onboarding from an accepted offer or add a new record manually.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="onboarding-table__name">{record.candidate_name}</div>
                      {record.employee_code ? (
                        <span className="onboarding-table__code">{record.employee_code}</span>
                      ) : null}
                    </td>
                    <td>{record.email}</td>
                    <td>{record.department}</td>
                    <td>{record.designation}</td>
                    <td>{formatEmployeeDate(record.joining_date)}</td>
                    <td>
                      <OnboardingStatusBadge status={record.status} />
                    </td>
                    <td>
                      <DocumentsStatusBadge status={record.documents_status} />
                    </td>
                    <td>{formatEmployeeDate(record.updated_at.slice(0, 10))}</td>
                    <td>
                      <Link to={`/hr/onboarding/${record.id}`} className="onboarding-table__action">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
