import { Badge } from '../ui';
import type { AcknowledgementStatus } from '../../types';
import { formatAcknowledgementStatus } from '../../utils/rbac';

const statusVariantMap: Record<AcknowledgementStatus, 'success' | 'warning'> = {
  PENDING: 'warning',
  ACKNOWLEDGED: 'success',
};

export function AcknowledgementStatusBadge({ status }: { status: AcknowledgementStatus }) {
  return <Badge variant={statusVariantMap[status]}>{formatAcknowledgementStatus(status)}</Badge>;
}
