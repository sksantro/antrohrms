import type { OfferLetterStatus } from '../../types';

const STATUS_LABELS: Record<OfferLetterStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const STATUS_CLASS: Record<OfferLetterStatus, string> = {
  DRAFT: 'offer-status-badge--draft',
  SENT: 'offer-status-badge--sent',
  ACCEPTED: 'offer-status-badge--accepted',
  REJECTED: 'offer-status-badge--rejected',
  EXPIRED: 'offer-status-badge--expired',
  CANCELLED: 'offer-status-badge--cancelled',
};

export function OfferLetterStatusBadge({ status }: { status: OfferLetterStatus }) {
  return (
    <span className={`offer-status-badge ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function formatOfferStatus(status: OfferLetterStatus): string {
  return STATUS_LABELS[status];
}
