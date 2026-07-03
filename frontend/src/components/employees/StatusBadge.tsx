import { Badge } from '../ui';
import type { EmployeeStatus } from '../../types';
import { formatStatus } from '../../utils/rbac';

const statusVariantMap: Record<EmployeeStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  RESIGNED: 'warning',
  TERMINATED: 'danger',
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return <Badge variant={statusVariantMap[status]}>{formatStatus(status)}</Badge>;
}
