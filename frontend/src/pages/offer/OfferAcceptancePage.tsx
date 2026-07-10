import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { OfferLetterStatusBadge } from '../../components/offer-letters/OfferLetterStatusBadge';
import { OfferLetterTemplate } from '../../components/offer-letters/OfferLetterTemplate';
import { Button, Card } from '../../components/ui';
import { ApiError } from '../../services/api';
import { offerLetterService } from '../../services/offerLetterService';
import type { OfferLetterPublic } from '../../types';

export function OfferAcceptancePage() {
  const { token } = useParams();
  const [offer, setOffer] = useState<OfferLetterPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadOffer = async () => {
      if (!token) {
        setError('Invalid offer link.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await offerLetterService.getPublic(token);
        setOffer(data);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Unable to load offer letter.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadOffer();
  }, [token]);

  const respond = async (action: 'accept' | 'reject') => {
    if (!token) {
      return;
    }

    const confirmed = window.confirm(
      action === 'accept'
        ? 'Are you sure you want to accept this offer?'
        : 'Are you sure you want to reject this offer?',
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await offerLetterService.respondPublic(token, action);
      setOffer(data);
      setSuccess(
        action === 'accept'
          ? 'Thank you. Your offer acceptance has been recorded.'
          : 'Your response has been recorded.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit your response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="offer-accept-page">
      <div className="offer-accept-page__shell">
        {isLoading ? (
          <Card wide className="offer-accept-page__card">
            <div className="offer-letters-page__loading">
              <span className="employees-page__loading-spinner" aria-hidden />
              <p>Loading your offer letter...</p>
            </div>
          </Card>
        ) : error && !offer ? (
          <Card wide className="offer-accept-page__card">
            <h2>Offer Unavailable</h2>
            <p className="form-error">{error}</p>
            <p className="muted">Please contact HR if you believe this is an error.</p>
          </Card>
        ) : offer ? (
          <>
            <Card wide className="offer-accept-page__card offer-accept-page__intro">
              <div className="offer-accept-page__intro-header">
                <div>
                  <span className="offer-accept-page__badge">{offer.company_name}</span>
                  <h1>Offer Letter</h1>
                  <p className="muted">
                    Hello {offer.candidate_name}, review your offer details below.
                  </p>
                </div>
                <OfferLetterStatusBadge status={offer.status} />
              </div>

              {error ? <p className="form-error">{error}</p> : null}
              {success ? <p className="offer-accept-page__success">{success}</p> : null}

              {offer.can_respond ? (
                <div className="offer-accept-page__actions">
                  <Button type="button" disabled={isSubmitting} onClick={() => void respond('accept')}>
                    Accept Offer
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSubmitting}
                    onClick={() => void respond('reject')}
                  >
                    Reject Offer
                  </Button>
                </div>
              ) : (
                <p className="offer-accept-page__note muted">
                  This offer is no longer available for response.
                </p>
              )}
            </Card>

            <Card wide className="offer-accept-page__card offer-letter-preview-card">
              <OfferLetterTemplate html={offer.preview_html} />
            </Card>
          </>
        ) : (
          <Card wide className="offer-accept-page__card">
            <h2>Offer Unavailable</h2>
            <p className="muted">This offer link is invalid or has expired.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
