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
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge variant={statusVariantMap[status]}>{formatAttendanceStatus(status)}</Badge>;
}
