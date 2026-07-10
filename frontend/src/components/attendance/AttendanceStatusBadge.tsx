import { Badge } from '../ui';
import type { AttendanceStatus } from '../../types';
import { formatAttendanceStatus } from '../../utils/rbac';

const statusVariantMap: Record<
  AttendanceStatus,
  'success' | 'neutral' | 'warning' | 'danger' | 'info'
> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  HALF_DAY: 'warning',
  LATE: 'warning',
  ON_LEAVE: 'info',
  HOLIDAY: 'neutral',
  MISSING_CHECKOUT: 'warning',
  MISSING_PUNCH: 'warning',
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge variant={statusVariantMap[status] ?? 'neutral'}>
      {formatAttendanceStatus(status)}
    </Badge>
  );
}
