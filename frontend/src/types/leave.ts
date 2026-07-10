export type LeaveType = 'CASUAL' | 'SICK' | 'EMERGENCY' | 'PLANNED' | 'UNPAID';

export type LeaveRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CANCELLATION_REQUESTED';

export type HalfDaySession = 'FIRST_HALF' | 'SECOND_HALF';

export interface LeaveBalance {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  year: number;
  paid_leave_balance: string;
  paid_leave_earned: string;
  paid_leave_used: string;
  lop_days: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  employee_email: string;
  employee_department: string;
  employee_designation: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_working_days: string;
  half_day: boolean;
  half_day_session: HalfDaySession | '';
  reason: string;
  status: LeaveRequestStatus;
  approval_level: string;
  approved_by: number | null;
  approved_by_name: string;
  approved_at: string | null;
  rejected_by: number | null;
  rejected_by_name: string;
  rejected_at: string | null;
  rejection_reason: string;
  escalated_to_hr: boolean;
  escalated_at: string | null;
  is_backdated: boolean;
  is_special_approval_required: boolean;
  lop_days: string;
  paid_leave_days: string;
  pending_days: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestFilters {
  status?: LeaveRequestStatus | '';
  employee?: number | '';
  department?: string;
  leave_type?: LeaveType | '';
  month?: number | '';
  year?: number | '';
  date_from?: string;
  date_to?: string;
  search?: string;
  escalated?: boolean;
  special_approval?: boolean;
}

export interface LeaveApplyPayload {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  half_day: boolean;
  half_day_session?: HalfDaySession | '';
  reason: string;
}

export interface LeaveRejectPayload {
  rejection_reason: string;
}

export interface AttendanceRegularization {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  is_backdated: boolean;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface RegularizationApplyPayload {
  date: string;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
}
