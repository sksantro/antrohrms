export type HolidayType =
  | 'COMPANY_HOLIDAY'
  | 'OPTIONAL_HOLIDAY'
  | 'FESTIVAL'
  | 'NATIONAL_HOLIDAY';

export interface CompanySettings {
  id: number;
  company_name: string;
  office_start_time: string;
  office_end_time: string;
  full_day_minimum_hours: string;
  half_day_minimum_hours: string;
  weekly_off_days: number[];
  weekly_off_day_labels: string[];
  financial_year_start_month: number;
  financial_year_start_month_label: string;
  leave_joining_cutoff_day: number;
  created_at: string;
  updated_at: string;
}

export interface CompanySettingsPayload {
  company_name?: string;
  office_start_time?: string;
  office_end_time?: string;
  full_day_minimum_hours?: number | string;
  half_day_minimum_hours?: number | string;
  weekly_off_days?: number[];
  financial_year_start_month?: number;
  leave_joining_cutoff_day?: number;
}

export interface CompanyHoliday {
  id: number;
  name: string;
  date: string;
  holiday_type: HolidayType;
  description: string;
  is_active: boolean;
  is_optional?: boolean;
  base_holiday_type?: HolidayType;
  created_at: string;
  updated_at: string;
}

export interface CompanyHolidayPayload {
  name: string;
  date: string;
  holiday_type: HolidayType;
  description?: string;
  is_active?: boolean;
}

export const WEEKDAY_OPTIONS = [
  { label: 'Monday', value: 0 },
  { label: 'Tuesday', value: 1 },
  { label: 'Wednesday', value: 2 },
  { label: 'Thursday', value: 3 },
  { label: 'Friday', value: 4 },
  { label: 'Saturday', value: 5 },
  { label: 'Sunday', value: 6 },
] as const;

export const MONTH_OPTIONS = [
  { label: 'January', value: 1 },
  { label: 'February', value: 2 },
  { label: 'March', value: 3 },
  { label: 'April', value: 4 },
  { label: 'May', value: 5 },
  { label: 'June', value: 6 },
  { label: 'July', value: 7 },
  { label: 'August', value: 8 },
  { label: 'September', value: 9 },
  { label: 'October', value: 10 },
  { label: 'November', value: 11 },
  { label: 'December', value: 12 },
] as const;

export const HOLIDAY_TYPE_OPTIONS = [
  { label: 'Company Holiday', value: 'COMPANY_HOLIDAY' as HolidayType },
  { label: 'Optional Holiday', value: 'OPTIONAL_HOLIDAY' as HolidayType },
  { label: 'Festival', value: 'FESTIVAL' as HolidayType },
  { label: 'National Holiday', value: 'NATIONAL_HOLIDAY' as HolidayType },
];

export function formatHolidayType(value: HolidayType): string {
  return HOLIDAY_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export interface DepartmentMaster {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentMasterPayload {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface DesignationMaster {
  id: number;
  name: string;
  department: number | null;
  department_name: string | null;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignationMasterPayload {
  name: string;
  department?: number | null;
  description?: string;
  is_active?: boolean;
}

export interface LeaveTypeMaster {
  id: number;
  code: string;
  name: string;
  annual_quota: string;
  is_paid: boolean;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveTypeMasterPayload {
  code: string;
  name: string;
  annual_quota?: number | string;
  is_paid?: boolean;
  description?: string;
  is_active?: boolean;
}

export interface PolicyCategoryMaster {
  id: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyCategoryMasterPayload {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface HolidayImportRow {
  row_number: number;
  name: string;
  date: string;
  holiday_type: HolidayType;
  description: string;
  is_valid: boolean;
  errors: string[];
}

export interface HolidayImportPreview {
  source_type: 'csv' | 'excel' | 'image';
  file_name: string;
  rows: HolidayImportRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  warnings: string[];
}

export interface HolidayImportResult {
  detail: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}
