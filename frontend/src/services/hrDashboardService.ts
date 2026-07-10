import { attendanceService } from './attendanceService';
import { employeeService } from './employeeService';
import { leaveService } from './leaveService';
import { offerLetterService } from './offerLetterService';
import { onboardingService } from './onboardingService';
import { policyService } from './policyService';
import type { AttendanceStatus } from '../types';

export interface HRDashboardMetrics {
  totalEmployees: number;
  activeEmployees: number;
  pendingOnboarding: number;
  pendingOfferAcceptance: number;
  pendingPolicyAcknowledgements: number;
  pendingLeaveRequests: number;
  todayPresent: number;
  todayAbsent: number;
}

export interface HRDashboardLoadResult {
  metrics: HRDashboardMetrics;
  partialErrors: string[];
}

export const EMPTY_HR_DASHBOARD_METRICS: HRDashboardMetrics = {
  totalEmployees: 0,
  activeEmployees: 0,
  pendingOnboarding: 0,
  pendingOfferAcceptance: 0,
  pendingPolicyAcknowledgements: 0,
  pendingLeaveRequests: 0,
  todayPresent: 0,
  todayAbsent: 0,
};

const PRESENT_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'HALF_DAY'];

function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function safeMetric<T>(
  label: string,
  loader: () => Promise<T>,
  fallback: T,
  errors: string[],
): Promise<T> {
  try {
    return await loader();
  } catch {
    errors.push(label);
    return fallback;
  }
}

export async function loadHRDashboardMetrics(): Promise<HRDashboardLoadResult> {
  const partialErrors: string[] = [];
  const metrics: HRDashboardMetrics = { ...EMPTY_HR_DASHBOARD_METRICS };
  const today = getTodayISO();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const employees = await safeMetric(
    'Employee records',
    () => employeeService.list(),
    [],
    partialErrors,
  );

  if (Array.isArray(employees)) {
    metrics.totalEmployees = employees.length;
    metrics.activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE').length;
  }

  metrics.pendingOnboarding = 0;

  const onboardingRecords = await safeMetric(
    'Onboarding records',
    () => onboardingService.list(),
    [],
    partialErrors,
  );

  if (Array.isArray(onboardingRecords)) {
    metrics.pendingOnboarding = onboardingRecords.filter((record) => record.status !== 'COMPLETED').length;
  }

  const offerLetters = await safeMetric(
    'Offer letters',
    () => offerLetterService.list({ status: 'SENT' }),
    [],
    partialErrors,
  );

  if (Array.isArray(offerLetters)) {
    metrics.pendingOfferAcceptance = offerLetters.length;
  }

  const policySummary = await safeMetric(
    'Policy acknowledgements',
    () => policyService.getPendingSummary(),
    null,
    partialErrors,
  );

  if (policySummary) {
    metrics.pendingPolicyAcknowledgements = policySummary.pending_acknowledgements ?? 0;
  }

  const leaveRequests = await safeMetric(
    'Leave requests',
    () => leaveService.listRequests({ year }),
    [],
    partialErrors,
  );

  if (Array.isArray(leaveRequests)) {
    metrics.pendingLeaveRequests = leaveRequests.filter(
      (request) => request.status === 'PENDING' || request.status === 'CANCELLATION_REQUESTED',
    ).length;
  }

  const attendanceRecords = await safeMetric(
    'Today attendance',
    () => attendanceService.list({ month, year }),
    [],
    partialErrors,
  );

  if (Array.isArray(attendanceRecords)) {
    const todayRecords = attendanceRecords.filter((record) => record.date === today);
    metrics.todayPresent = todayRecords.filter((record) => PRESENT_STATUSES.includes(record.status)).length;
    metrics.todayAbsent = todayRecords.filter((record) => record.status === 'ABSENT').length;
  }

  return { metrics, partialErrors };
}
