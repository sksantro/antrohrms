import { Badge } from '../ui';
import type { LeadStatus } from '../../types/lead';
import { formatLeadStatus } from '../../utils/rbac';

const STATUS_VARIANT: Record<LeadStatus, 'success' | 'neutral' | 'warning' | 'danger' | 'info' | 'accent'> = {
  NEW: 'info',
  CONTACTED: 'neutral',
  INTERESTED: 'success',
  FOLLOW_UP_REQUIRED: 'warning',
  MEETING_BOOKED: 'accent',
  PROPOSAL_SENT: 'info',
  NOT_INTERESTED: 'danger',
  CLOSED: 'neutral',
  LOST: 'danger',
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{formatLeadStatus(status)}</Badge>;
}
