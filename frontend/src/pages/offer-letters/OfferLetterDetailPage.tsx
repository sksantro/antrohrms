import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { OfferLetterStatusBadge } from '../../components/offer-letters/OfferLetterStatusBadge';
import { OfferLetterTemplate } from '../../components/offer-letters/OfferLetterTemplate';
import { Button, Card } from '../../components/ui';
import { ApiError } from '../../services/api';
import { offerLetterService } from '../../services/offerLetterService';
import type { OfferLetter } from '../../types';
import { formatEmployeeDate } from '../../utils/employeeFilters';
import { formatEmploymentType } from '../../utils/rbac';

export function OfferLetterDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<OfferLetter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOffer = async () => {
    if (!id) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await offerLetterService.get(Number(id));
      setOffer(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to load offer letter.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOffer();
  }, [id]);

  const handleSend = async () => {
    if (!offer || !window.confirm(`Send offer letter ${offer.offer_id} to ${offer.email}?`)) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const response = await offerLetterService.send(offer.id);
      setInfo(response.detail);
      await loadOffer();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to send offer letter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!offer || !window.confirm(`Cancel offer letter ${offer.offer_id}?`)) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await offerLetterService.cancel(offer.id);
      await loadOffer();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel offer letter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!offer || !window.confirm(`Delete draft offer ${offer.offer_id}?`)) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await offerLetterService.delete(offer.id);
      navigate('/hr/offer-letters');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete offer letter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card wide className="offer-letters-page__card">
        <div className="offer-letters-page__loading">
          <span className="employees-page__loading-spinner" aria-hidden />
          <p>Loading offer letter...</p>
        </div>
      </Card>
    );
  }

  if (error && !offer) {
    return (
      <Card wide className="offer-letters-page__card">
        <p className="form-error">{error}</p>
        <Link to="/hr/offer-letters">Back to offer letters</Link>
      </Card>
    );
  }

  if (!offer) {
    return (
      <Card wide className="offer-letters-page__card">
        <p className="form-error">Offer letter not found.</p>
        <Link to="/hr/offer-letters">Back to offer letters</Link>
      </Card>
    );
  }

  const acceptanceLink = `${window.location.origin}/offer/accept/${offer.acceptance_token}`;
  const previewHtml =
    offer.status === 'ACCEPTED' && offer.accepted_document_snapshot
      ? offer.accepted_document_snapshot
      : offer.preview_html ?? '';

  return (
    <div className="offer-letters-page">
      <div className="offer-letter-detail-layout">
        <Card wide className="offer-letters-page__card">
          <div className="offer-letter-detail__header">
            <div>
              <span className="offer-letter-detail__id">{offer.offer_id}</span>
              <h2>{offer.candidate_name}</h2>
              <p className="muted">
                {offer.designation} · {offer.department}
              </p>
            </div>
            <div className="offer-letter-detail__actions">
              <Link to="/hr/offer-letters" className="offer-letter-detail__action">
                Back
              </Link>
              {offer.status === 'DRAFT' || offer.status === 'SENT' ? (
                <Link to={`/hr/offer-letters/${offer.id}/edit`} className="offer-letter-detail__action offer-letter-detail__action--primary">
                  Edit
                </Link>
              ) : null}
              {offer.status === 'DRAFT' || offer.status === 'SENT' ? (
                <Button type="button" disabled={isSubmitting} onClick={() => void handleSend()}>
                  Send Offer
                </Button>
              ) : null}
              {offer.status !== 'ACCEPTED' &&
              offer.status !== 'REJECTED' &&
              offer.status !== 'CANCELLED' ? (
                <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => void handleCancel()}>
                  Cancel
                </Button>
              ) : null}
              {offer.status === 'DRAFT' ? (
                <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => void handleDelete()}>
                  Delete
                </Button>
              ) : null}
            </div>
          </div>

          <div className="offer-letter-detail__status">
            <OfferLetterStatusBadge status={offer.status} />
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {info ? <p className="offer-letter-detail__info">{info}</p> : null}

          <div className="detail-grid offer-letter-detail-grid">
            <DetailItem label="Email" value={offer.email} />
            <DetailItem label="Phone" value={offer.phone || '—'} />
            <DetailItem label="Joining Date" value={formatEmployeeDate(offer.joining_date)} />
            <DetailItem label="Offer Valid Till" value={formatEmployeeDate(offer.offer_valid_till)} />
            <DetailItem label="Employment Type" value={formatEmploymentType(offer.employment_type)} />
            <DetailItem label="Work Location" value={offer.work_location || '—'} />
            <DetailItem
              label="Reporting Manager"
              value={offer.reporting_manager_display || offer.reporting_manager_name || '—'}
            />
            <DetailItem label="Created Date" value={formatEmployeeDate(offer.created_at.slice(0, 10))} />
            {offer.sent_at ? (
              <DetailItem label="Sent Date" value={formatEmployeeDate(offer.sent_at.slice(0, 10))} />
            ) : null}
            {offer.accepted_at ? (
              <DetailItem label="Accepted Date" value={formatEmployeeDate(offer.accepted_at.slice(0, 10))} />
            ) : null}
            {offer.rejected_at ? (
              <DetailItem label="Rejected Date" value={formatEmployeeDate(offer.rejected_at.slice(0, 10))} />
            ) : null}
            <DetailItem label="Acceptance Link" value={acceptanceLink} fullWidth />
            {offer.notes ? <DetailItem label="Internal Notes" value={offer.notes} fullWidth /> : null}
          </div>
        </Card>

        <Card wide className="offer-letters-page__card offer-letter-preview-card">
          <div className="offer-letter-preview-card__header">
            <h3>Offer Letter Preview</h3>
            <p className="muted">Professional letterhead layout for review and candidate sharing.</p>
          </div>
          <OfferLetterTemplate html={previewHtml} />
        </Card>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'detail-item full-width' : 'detail-item'}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
