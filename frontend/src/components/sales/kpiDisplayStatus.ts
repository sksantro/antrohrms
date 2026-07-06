export type KpiDisplayStatus = 'Matched' | 'At Risk' | 'Not Matched' | 'Loading' | 'Not Started';

export function getKpiDisplayStatus(
  completed: number,
  target: number,
  loading = false,
): KpiDisplayStatus {
  if (loading) {
    return 'Loading';
  }
  if (completed >= target) {
    return 'Matched';
  }
  if (completed > 0) {
    return 'At Risk';
  }
  return 'Not Matched';
}

export function getKpiPendingCount(completed: number, target: number): number {
  return Math.max(0, target - completed);
}

export function getKpiStatusClass(status: string): string {
  if (status === 'Matched') return 'is-matched';
  if (status === 'At Risk') return 'is-at-risk';
  if (status === 'Not Matched') return 'is-not-matched';
  return '';
}
