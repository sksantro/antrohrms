export type UserRole =
  | 'SUPER_ADMIN'
  | 'HR_ADMIN'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'FINANCE';

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  is_staff: boolean;
  must_change_password: boolean;
  date_joined: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  detail: string;
  must_change_password: boolean;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  password: string;
  is_active?: boolean;
  is_staff?: boolean;
}

export type PermissionKey =
  | 'can_manage_users'
  | 'can_manage_employees'
  | 'can_view_employees'
  | 'can_view_team_employees'
  | 'can_view_employee_profile'
  | 'can_approve_payroll'
  | 'can_view_admin_dashboard'
  | 'can_view_manager_dashboard'
  | 'can_view_finance_dashboard'
  | 'can_view_employee_dashboard'
  | 'can_check_in_out'
  | 'can_view_own_attendance'
  | 'can_view_all_attendance'
  | 'can_view_team_attendance'
  | 'can_manage_attendance'
  | 'can_view_attendance_summary'
  | 'can_apply_leave'
  | 'can_view_own_leaves'
  | 'can_view_team_leaves'
  | 'can_view_all_leaves'
  | 'can_approve_leaves'
  | 'can_manage_leave_types'
  | 'can_manage_leave_balances'
  | 'can_view_leave_reports'
  | 'can_manage_policies'
  | 'can_view_all_policies'
  | 'can_view_own_policies'
  | 'can_acknowledge_policies'
  | 'can_view_policy_compliance'
  | 'can_view_team_policy_compliance'
  | 'can_view_finance_policies'
  | 'can_manage_company_settings'
  | 'can_manage_holidays'
  | 'can_delete_employees'
  | 'can_assign_elevated_employee_roles'
  | 'can_manage_salary_structures'
  | 'can_manage_payroll_runs'
  | 'can_manage_payroll_profiles'
  | 'can_view_company_settings';

export type RolePermissions = Record<PermissionKey, boolean>;
