import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { PageHeader } from '../../components/PageHeader';
import {
  DocumentsStatusBadge,
  OnboardingStatusBadge,
} from '../../components/onboarding/OnboardingStatusBadge';
import { Button, ButtonLink, Card, Textarea } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { onboardingService } from '../../services/onboardingService';
import type { OnboardingRecord } from '../../types';
import { ONBOARDING_DOCUMENT_LABELS } from '../../types/onboarding';
import { formatEmployeeDate } from '../../utils/employeeFilters';

export function OnboardingDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const recordId = Number(id);
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const canManage = can('can_manage_hr_onboarding');

  const loadRecord = useCallback(async () => {
    if (!recordId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await onboardingService.get(recordId);
      setRecord(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load onboarding record.');
      setRecord(null);
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  const runAction = async (action: () => Promise<OnboardingRecord>, successMessage?: string) => {
    if (!window.confirm('Are you sure you want to continue with this action?')) {
      return;
    }
    setIsActing(true);
    setActionError(null);
    try {
      const updated = await action();
      setRecord(updated);
      if (successMessage) {
        setActionError(null);
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="onboarding-detail-page__loading">
        <span className="employees-page__loading-spinner" aria-hidden />
        <p>Loading onboarding details...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <Card wide>
        <p className="form-error">{error ?? 'Onboarding record not found.'}</p>
        <ButtonLink to="/hr/onboarding" variant="secondary">
          Back to onboarding
        </ButtonLink>
      </Card>
    );
  }

  const profile = record.profile_data ?? {};

  return (
    <div className="onboarding-detail-page">
      <Card wide className="onboarding-detail-page__card">
        <div className="onboarding-detail-page__header">
          <div>
            <span className="onboarding-detail-page__id">{record.onboarding_id}</span>
            <PageHeader
              title={record.candidate_name}
              description={`${record.designation} · ${record.department}`}
            />
            <div className="onboarding-detail-page__badges">
              <OnboardingStatusBadge status={record.status} />
              <DocumentsStatusBadge status={record.documents_status} />
            </div>
          </div>
          <ButtonLink to="/hr/onboarding" variant="secondary">
            Back to list
          </ButtonLink>
        </div>

        {actionError ? <p className="form-error">{actionError}</p> : null}

        {canManage ? (
          <div className="onboarding-detail-page__actions">
            {record.status !== 'COMPLETED' ? (
              <>
                <Button
                  type="button"
                  disabled={isActing}
                  onClick={() =>
                    runAction(() =>
                      record.invited_at
                        ? onboardingService.resendInvite(record.id)
                        : onboardingService.sendInvite(record.id),
                    )
                  }
                >
                  {record.invited_at ? 'Resend Invite' : 'Send Invite'}
                </Button>
                {record.invited_at ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/onboarding/${record.invite_token}`,
                      );
                    }}
                  >
                    Copy Invite Link
                  </Button>
                ) : null}
              </>
            ) : null}
            {record.status === 'SUBMITTED' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isActing}
                onClick={() => runAction(() => onboardingService.startReview(record.id))}
              >
                Start Review
              </Button>
            ) : null}
            {['SUBMITTED', 'UNDER_REVIEW'].includes(record.status) ? (
              <>
                <Button
                  type="button"
                  disabled={isActing}
                  onClick={() => runAction(() => onboardingService.approve(record.id))}
                >
                  Approve & Complete
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isActing}
                  onClick={() => setShowRejectForm((value) => !value)}
                >
                  Request Correction
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {showRejectForm && canManage ? (
          <div className="onboarding-detail-page__reject">
            <Textarea
              id="reject_reason"
              label="Correction reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              required
            />
            <Button
              type="button"
              variant="secondary"
              disabled={isActing || !rejectReason.trim()}
              onClick={() =>
                runAction(() => onboardingService.reject(record.id, rejectReason), 'rejected')
              }
            >
              Send Back for Correction
            </Button>
          </div>
        ) : null}

        <div className="onboarding-detail-page__grid">
          <Card className="onboarding-detail-page__panel">
            <h3>Overview</h3>
            <dl>
              <div><dt>Email</dt><dd>{record.email}</dd></div>
              <div><dt>Phone</dt><dd>{record.phone || '—'}</dd></div>
              <div><dt>Joining Date</dt><dd>{formatEmployeeDate(record.joining_date)}</dd></div>
              <div><dt>Work Location</dt><dd>{record.work_location || '—'}</dd></div>
              <div><dt>Employee Code</dt><dd>{record.employee_code || 'Pending completion'}</dd></div>
              <div><dt>Offer Ref</dt><dd>{record.offer_id ? <Link to={`/hr/offer-letters/${record.offer_letter}`}>{record.offer_id}</Link> : '—'}</dd></div>
              <div><dt>Invited</dt><dd>{record.invited_at ? formatEmployeeDate(record.invited_at.slice(0, 10)) : 'Not yet'}</dd></div>
              <div><dt>Submitted</dt><dd>{record.submitted_at ? formatEmployeeDate(record.submitted_at.slice(0, 10)) : '—'}</dd></div>
              <div><dt>Last Updated</dt><dd>{formatEmployeeDate(record.updated_at.slice(0, 10))}</dd></div>
            </dl>
          </Card>

          <Card className="onboarding-detail-page__panel">
            <h3>Submitted Profile</h3>
            <dl>
              <div><dt>Name</dt><dd>{profile.first_name || '—'} {profile.last_name || ''}</dd></div>
              <div><dt>Gender</dt><dd>{profile.gender || '—'}</dd></div>
              <div><dt>Date of Birth</dt><dd>{profile.date_of_birth || '—'}</dd></div>
              <div><dt>Address</dt><dd>{profile.address || '—'}</dd></div>
              <div><dt>Emergency Contact</dt><dd>{profile.emergency_contact_name || '—'} ({profile.emergency_contact_phone || '—'})</dd></div>
            </dl>
            {record.correction_reason ? (
              <p className="onboarding-detail-page__correction">
                <strong>Correction requested:</strong> {record.correction_reason}
              </p>
            ) : null}
          </Card>

          <Card className="onboarding-detail-page__panel onboarding-detail-page__panel--wide">
            <h3>Documents</h3>
            <div className="onboarding-detail-page__documents">
              {Object.entries(ONBOARDING_DOCUMENT_LABELS).map(([type, label]) => {
                const doc = record.documents.find((item) => item.document_type === type);
                return (
                  <div key={type} className="onboarding-document-row">
                    <span>{label}</span>
                    {doc ? (
                      <a href={doc.file_url ?? '#'} target="_blank" rel="noreferrer" className="onboarding-document-row__uploaded">
                        {doc.original_filename || 'Uploaded'}
                      </a>
                    ) : (
                      <span className="onboarding-document-row__missing">Missing</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
