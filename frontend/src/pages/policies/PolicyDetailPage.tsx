import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AcknowledgementStatusBadge } from '../../components/policies/AcknowledgementStatusBadge';
import { Badge, Button } from '../../components/ui';
import {
  CalendarIcon,
  ChevronLeftIcon,
  DocIcon,
  DownloadIcon,
  ShieldIcon,
  TextIcon,
} from '../../components/policies/policyIcons';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { policyService } from '../../services/policyService';
import type { Policy } from '../../types';
import { formatPolicyCategory, getPoliciesBasePath } from '../../utils/rbac';

export function PolicyDetailPage() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const basePath = user ? getPoliciesBasePath(user.role, user.department) : '/admin/policies';
  const canManage = can('can_manage_policies');
  const canAcknowledge = can('can_acknowledge_policies');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAckConfirm, setShowAckConfirm] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  const loadPolicy = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await policyService.get(Number(id));
      setPolicy(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load policy.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPolicy();
  }, [id]);

  const handleAcknowledge = async () => {
    if (!id) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await policyService.acknowledge(
        Number(id),
        'I have read and understood this company policy.',
      );
      setSuccess('Policy acknowledged successfully.');
      setShowAckConfirm(false);
      setAckChecked(false);
      await loadPolicy();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to acknowledge policy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const runStatusAction = async (message: string, action: () => Promise<Policy>) => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const updated = await action();
      setPolicy(updated);
      setSuccess(message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update policy status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="muted">Loading...</p>
        </section>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="form-error">{error ?? 'Policy not found.'}</p>
          <Link to={basePath}>Back</Link>
        </section>
      </div>
    );
  }

  const isPending = policy.acknowledgement_status === 'PENDING';

  return (
    <div className="payroll-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <div className="payroll-header__title-row">
              <h2 className="payroll-title">{policy.title}</h2>
              <Badge
                variant={
                  policy.status === 'PUBLISHED'
                    ? 'success'
                    : policy.status === 'DRAFT'
                      ? 'warning'
                      : policy.status === 'UNPUBLISHED'
                        ? 'danger'
                        : 'info'
                }
              >
                {policy.status_label}
              </Badge>
            </div>
            <p className="payroll-subtitle">
              Version {policy.version} · {formatPolicyCategory(policy.category)}
            </p>
          </div>
          <div className="payroll-header__actions">
            <Link className="payroll-back" to={basePath}>
              <ChevronLeftIcon />
              Back
            </Link>
            {canManage ? (
              <Link className="payroll-action" to={`${basePath}/${policy.id}/edit`}>
                Edit
              </Link>
            ) : null}
            {canManage && policy.status === 'DRAFT' ? (
              <button
                type="button"
                className="payroll-action"
                disabled={isSubmitting}
                onClick={() => {
                  if (!window.confirm('Publish this policy?')) return;
                  void runStatusAction('Policy published.', () => policyService.publish(policy.id));
                }}
              >
                Publish
              </button>
            ) : null}
            {canManage && policy.status === 'PUBLISHED' ? (
              <button
                type="button"
                className="payroll-action payroll-action--danger"
                disabled={isSubmitting}
                onClick={() => {
                  if (!window.confirm('Unpublish this policy?')) return;
                  void runStatusAction('Policy unpublished.', () => policyService.unpublish(policy.id));
                }}
              >
                Unpublish
              </button>
            ) : null}
            {canManage && policy.status !== 'ARCHIVED' && policy.status !== 'PUBLISHED' ? (
              <button
                type="button"
                className="payroll-action payroll-action--danger"
                disabled={isSubmitting}
                onClick={() => {
                  if (!window.confirm('Archive this policy?')) return;
                  void runStatusAction('Policy archived.', () => policyService.archive(policy.id));
                }}
              >
                Archive
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <DetailSection title="Policy Info" icon={<DocIcon />}>
          <DetailItem label="Category" value={<Badge variant="info">{formatPolicyCategory(policy.category)}</Badge>} />
          <DetailItem
            label="Status"
            value={
              <Badge
                variant={
                  policy.status === 'PUBLISHED'
                    ? 'success'
                    : policy.status === 'DRAFT'
                      ? 'warning'
                      : policy.status === 'UNPUBLISHED'
                        ? 'danger'
                        : 'info'
                }
              >
                {policy.status_label}
              </Badge>
            }
          />
          <DetailItem label="Applies To" value={policy.applies_to_label} />
          <DetailItem
            label="Requires Acknowledgement"
            value={policy.requires_acknowledgement ? 'Yes' : 'No'}
          />
          {policy.acknowledgement_status ? (
            <DetailItem
              label="Your Acknowledgement"
              value={<AcknowledgementStatusBadge status={policy.acknowledgement_status} />}
            />
          ) : null}
        </DetailSection>

        <DetailSection title="Version & Effective Date" icon={<CalendarIcon />}>
          <DetailItem label="Version" value={<span className="pol-version-pill">v{policy.version}</span>} />
          <DetailItem label="Effective Date" value={policy.effective_date} />
        </DetailSection>

        <DetailSection title="Owner / Created By" icon={<ShieldIcon />}>
          <DetailItem label="Created By" value={policy.created_by_name || '-'} />
          <DetailItem
            label="Created At"
            value={policy.created_at ? new Date(policy.created_at).toLocaleString('en-IN') : '-'}
          />
          <DetailItem
            label="Last Updated"
            value={policy.updated_at ? new Date(policy.updated_at).toLocaleString('en-IN') : '-'}
          />
        </DetailSection>

        <section className="payroll-detail-section">
          <div className="payroll-detail-section__head">
            <span className="payroll-detail-section__icon" aria-hidden>
              <TextIcon />
            </span>
            <h3 className="payroll-detail-section__title">Description</h3>
          </div>
          <p className="pol-description">{policy.description || 'No description provided.'}</p>
          {policy.policy_content ? (
            <pre className="pol-content-preview">{policy.policy_content}</pre>
          ) : null}
        </section>

        {policy.policy_file_url ? (
          <a className="pol-doc-card" href={policy.policy_file_url} target="_blank" rel="noreferrer">
            <span className="pol-doc-card__icon">
              <DocIcon size={22} />
            </span>
            <span className="pol-doc-card__body">
              <span className="pol-doc-card__title">Policy Document</span>
              <span className="pol-doc-card__meta">View or download the official document</span>
            </span>
            <span className="pol-doc-card__action">
              <DownloadIcon size={18} />
              View / Download
            </span>
          </a>
        ) : null}

        {canAcknowledge && policy.status === 'PUBLISHED' && policy.requires_acknowledgement && isPending ? (
          <div className="pol-ack-bar">
            {!showAckConfirm ? (
              <Button type="button" disabled={isSubmitting} onClick={() => setShowAckConfirm(true)}>
                I Agree / Acknowledge
              </Button>
            ) : (
              <div className="pol-ack-confirm">
                <label className="pol-ack-confirm__check">
                  <input
                    type="checkbox"
                    checked={ackChecked}
                    onChange={(event) => setAckChecked(event.target.checked)}
                  />
                  <span>I have read and understood this company policy.</span>
                </label>
                <div className="pol-ack-confirm__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      setShowAckConfirm(false);
                      setAckChecked(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting || !ackChecked}
                    onClick={() => void handleAcknowledge()}
                  >
                    {isSubmitting ? 'Submitting...' : 'Confirm Acknowledgement'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="payroll-detail-section">
      <div className="payroll-detail-section__head">
        <span className="payroll-detail-section__icon" aria-hidden>
          {icon}
        </span>
        <h3 className="payroll-detail-section__title">{title}</h3>
      </div>
      <div className="payroll-detail-grid">{children}</div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
