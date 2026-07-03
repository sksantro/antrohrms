export type WorkMode = 'OFFICE' | 'WORK_FROM_HOME' | 'CLIENT_LOCATION';

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'LATE'
  | 'ON_LEAVE'
  | 'HOLIDAY';

export interface Attendance {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  department: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  work_mode: WorkMode;
  status: AttendanceStatus;
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
  status?: AttendanceStatus | '';
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
