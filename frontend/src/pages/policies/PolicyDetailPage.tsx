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
  const basePath = user ? getPoliciesBasePath(user.role) : '/admin/policies';
  const canManage = can('can_manage_policies');
  const canAcknowledge = can('can_acknowledge_policies');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await policyService.acknowledge(Number(id));
      setSuccess('Policy acknowledged successfully.');
      await loadPolicy();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to acknowledge policy.');
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
              <Badge variant={policy.is_active ? 'success' : 'danger'}>
                {policy.is_active ? 'Active' : 'Inactive'}
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
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <DetailSection title="Policy Info" icon={<DocIcon />}>
          <DetailItem label="Category" value={<Badge variant="info">{formatPolicyCategory(policy.category)}</Badge>} />
          <DetailItem
            label="Status"
            value={
              <Badge variant={policy.is_active ? 'success' : 'danger'}>
                {policy.is_active ? 'Active' : 'Inactive'}
              </Badge>
            }
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

        {canAcknowledge && policy.is_active && isPending ? (
          <div className="pol-ack-bar">
            <Button type="button" disabled={isSubmitting} onClick={() => void handleAcknowledge()}>
              {isSubmitting ? 'Submitting...' : 'I Agree / Acknowledge'}
            </Button>
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
