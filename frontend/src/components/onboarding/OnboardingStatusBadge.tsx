import type { OnboardingStatus } from '../../types';
import { formatOnboardingStatus } from '../../types/onboarding';

const STATUS_CLASS: Record<OnboardingStatus, string> = {
  NOT_STARTED: 'onboarding-status-badge--neutral',
  INVITED: 'onboarding-status-badge--info',
  PROFILE_PENDING: 'onboarding-status-badge--warning',
  DOCUMENTS_PENDING: 'onboarding-status-badge--warning',
  SUBMITTED: 'onboarding-status-badge--info',
  UNDER_REVIEW: 'onboarding-status-badge--review',
  COMPLETED: 'onboarding-status-badge--success',
  CORRECTION_REQUIRED: 'onboarding-status-badge--danger',
};

export function OnboardingStatusBadge({ status }: { status: OnboardingStatus }) {
  return (
    <span className={`onboarding-status-badge ${STATUS_CLASS[status]}`}>
      {formatOnboardingStatus(status)}
    </span>
  );
}

export function DocumentsStatusBadge({ status }: { status: string }) {
  const className =
    status === 'Complete'
      ? 'onboarding-doc-status--complete'
      : status === 'Partial'
        ? 'onboarding-doc-status--partial'
        : 'onboarding-doc-status--pending';
  return <span className={`onboarding-doc-status ${className}`}>{status}</span>;
}
