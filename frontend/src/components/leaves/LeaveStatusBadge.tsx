import { Badge } from '../ui';
import type { LeaveRequestStatus } from '../../types';
import { formatLeaveStatus } from '../../utils/rbac';

const statusVariantMap: Record<
  LeaveRequestStatus,
  'success' | 'neutral' | 'warning' | 'danger' | 'accent'
> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  CANCELLATION_REQUESTED: 'accent',
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return <Badge variant={statusVariantMap[status]}>{formatLeaveStatus(status)}</Badge>;
}
