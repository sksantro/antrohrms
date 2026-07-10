import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../../components/PageHeader';
import {
  OfferLetterFiltersBar,
  useDebouncedValue,
} from '../../components/offer-letters/OfferLetterFiltersBar';
import { OfferLetterStatusBadge } from '../../components/offer-letters/OfferLetterStatusBadge';
import { ButtonLink, Card, Table } from '../../components/ui';
import { ApiError } from '../../services/api';
import { offerLetterService } from '../../services/offerLetterService';
import type { OfferLetter } from '../../types';
import { emptyOfferLetterFilters } from '../../types/offerLetter';
import { formatEmployeeDate } from '../../utils/employeeFilters';

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function OfferLetterListPage() {
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [filters, setFilters] = useState(emptyOfferLetterFilters);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebouncedValue(filters.search);

  const activeFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const designations = useMemo(
    () =>
      Array.from(new Set(offers.map((offer) => offer.designation).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [offers],
  );

  useEffect(() => {
    const loadOffers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await offerLetterService.list(activeFilters);
        setOffers(Array.isArray(data) ? data : []);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Unable to load offer letters.';
        setError(message);
        setOffers([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadOffers();
  }, [activeFilters]);

  return (
    <div className="offer-letters-page">
      <Card wide className="offer-letters-page__card">
        <PageHeader
          title="Offer Letters"
          description="Create, preview, send, and track candidate offer letters."
          actions={
            <div className="offer-letters-page__header-actions">
              <ButtonLink to="/hr/offer-letters/template-preview" variant="secondary">
                Template Preview
              </ButtonLink>
              <ButtonLink to="/hr/offer-letters/new" className="offer-letters-page__add-button">
                <PlusIcon />
                Create Offer Letter
              </ButtonLink>
            </div>
          }
        />

        {error ? <p className="form-error offer-letters-page__error">{error}</p> : null}

        <OfferLetterFiltersBar
          filters={filters}
          designations={designations}
          resultCount={offers.length}
          totalCount={offers.length}
          onChange={setFilters}
          onReset={() => setFilters(emptyOfferLetterFilters)}
        />

        {isLoading ? (
          <div className="offer-letters-page__loading">
            <span className="employees-page__loading-spinner" aria-hidden />
            <p>Loading offer letters...</p>
          </div>
        ) : (
          <Table className="offer-letters-table-wrap">
            <thead>
              <tr>
                <th>Offer ID</th>
                <th>Candidate / Employee</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="offer-letters-table__empty">
                    <div className="offer-letters-table__empty-state">
                      <strong>No offer letters found</strong>
                      <span>Create a new offer letter or adjust your filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <span className="offer-letters-table__code">{offer.offer_id}</span>
                    </td>
                    <td>{offer.candidate_name}</td>
                    <td>{offer.email}</td>
                    <td>{offer.designation}</td>
                    <td>{offer.department}</td>
                    <td>{formatEmployeeDate(offer.joining_date)}</td>
                    <td>
                      <OfferLetterStatusBadge status={offer.status} />
                    </td>
                    <td>{formatEmployeeDate(offer.created_at.slice(0, 10))}</td>
                    <td>
                      <div className="offer-letters-table__actions">
                        <Link to={`/hr/offer-letters/${offer.id}`} className="offer-letters-table__action">
                          View
                        </Link>
                        {offer.status === 'DRAFT' || offer.status === 'SENT' ? (
                          <Link
                            to={`/hr/offer-letters/${offer.id}/edit`}
                            className="offer-letters-table__action"
                          >
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
        )}
      </Card>
    </div>
  );
}
