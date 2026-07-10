export type WorkMode = 'OFFICE' | 'WORK_FROM_HOME' | 'CLIENT_LOCATION';

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'LATE'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'MISSING_CHECKOUT'
  | 'MISSING_PUNCH';

export interface Attendance {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  employee_email?: string;
  department: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  work_mode: WorkMode;
  status: AttendanceStatus;
  display_status?: AttendanceStatus | string;
  late_status?: string;
  regularization_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  total_work_hours: string;
  late_minutes: number;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSummary {
  total_records: number;
  present: number;
  absent: number;
  late: number;
  half_day: number;
  on_leave: number;
  holiday: number;
  missing_punch?: number;
  total_work_hours: string;
  total_late_minutes: number;
}

export interface MyAttendanceResponse {
  today: Attendance | null;
  records: Attendance[];
}

export interface AttendanceFilters {
  employee?: number | '';
  department?: string;
  month?: number | '';
  year?: number | '';
  date?: string;
  date_from?: string;
  date_to?: string;
  status?: AttendanceStatus | '';
  search?: string;
  regularization_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | '';
}

export interface AttendanceCreatePayload {
  employee: number;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  work_mode: WorkMode;
  status: AttendanceStatus;
  remarks?: string;
}

export interface AttendanceUpdatePayload {
  check_in_time?: string | null;
  check_out_time?: string | null;
  work_mode?: WorkMode;
  status?: AttendanceStatus;
  remarks?: string;
}

export interface DailyReportSummary {
  work_summary_today: string;
  key_companies_worked_on: string;
  interested_leads_summary: string;
  meetings_demo_updates: string;
  issues_blockers: string;
}

export interface SalesCheckOutPayload {
  remarks?: string;
  daily_report_summary: DailyReportSummary;
  tomorrow_plan: string;
  kpi_miss_reason?: string;
}
