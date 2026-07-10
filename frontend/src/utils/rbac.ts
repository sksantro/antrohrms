import type { PermissionKey, RolePermissions, User, UserRole } from '../types';
import { HR_DEPARTMENT, SALES_MARKETING_DEPARTMENT } from '../types/employee';

export function isSalesMarketingDepartment(department?: string | null): boolean {
  return department === SALES_MARKETING_DEPARTMENT;
}

export function isHRDepartment(department?: string | null): boolean {
  return department === HR_DEPARTMENT;
}

export function isHRUser(role: UserRole, department?: string | null): boolean {
  return role === 'HR_ADMIN' || (role === 'EMPLOYEE' && isHRDepartment(department));
}

function createEmptyPermissions(): RolePermissions {
  return {
    can_access_hr_workspace: false,
    can_view_hr_dashboard: false,
    can_manage_hr_employees: false,
    can_view_hr_offer_letters: false,
    can_manage_hr_offer_letters: false,
    can_view_hr_onboarding: false,
    can_manage_hr_onboarding: false,
    can_view_hr_employees: false,
    can_view_hr_attendance: false,
    can_view_hr_leave_management: false,
    can_view_hr_policies: false,
    can_manage_hr_policies: false,
    can_view_hr_policy_compliance: false,
    can_view_hr_my_profile: false,
    can_view_hr_company_settings: false,
    can_manage_hr_company_settings: false,
    can_manage_users: false,
    can_manage_employees: false,
    can_view_employees: false,
    can_view_team_employees: false,
    can_view_employee_profile: false,
    can_approve_payroll: false,
    can_view_admin_dashboard: false,
    can_view_manager_dashboard: false,
    can_view_finance_dashboard: false,
    can_view_employee_dashboard: false,
    can_check_in_out: false,
    can_view_own_attendance: false,
    can_view_all_attendance: false,
    can_view_team_attendance: false,
    can_manage_attendance: false,
    can_view_attendance_summary: false,
    can_apply_leave: false,
    can_view_own_leaves: false,
    can_view_team_leaves: false,
    can_view_all_leaves: false,
    can_approve_leaves: false,
    can_manage_leave_types: false,
    can_manage_leave_balances: false,
    can_view_leave_reports: false,
    can_manage_policies: false,
    can_view_all_policies: false,
    can_view_own_policies: false,
    can_acknowledge_policies: false,
    can_view_policy_compliance: false,
    can_view_team_policy_compliance: false,
    can_view_finance_policies: false,
    can_manage_company_settings: false,
    can_manage_holidays: false,
    can_delete_employees: false,
    can_assign_elevated_employee_roles: false,
    can_manage_salary_structures: false,
    can_manage_payroll_runs: false,
    can_manage_payroll_profiles: false,
    can_view_company_settings: false,
    can_view_leads: false,
    can_manage_leads: false,
    can_view_sales_command_center: false,
  };
}

function getHRPermissions(): RolePermissions {
  return {
    ...createEmptyPermissions(),
    can_access_hr_workspace: true,
    can_view_hr_dashboard: true,
    can_manage_hr_employees: true,
    can_view_hr_offer_letters: true,
    can_manage_hr_offer_letters: true,
    can_view_hr_onboarding: true,
    can_manage_hr_onboarding: true,
    can_view_hr_employees: true,
    can_view_hr_attendance: true,
    can_view_hr_leave_management: true,
    can_view_hr_policies: true,
    can_manage_hr_policies: true,
    can_view_hr_policy_compliance: true,
    can_view_hr_my_profile: true,
    can_view_hr_company_settings: true,
    can_manage_hr_company_settings: true,
    can_manage_holidays: true,
    can_manage_leave_types: true,
    can_view_own_attendance: true,
    can_view_own_leaves: true,
    can_view_own_policies: true,
    can_apply_leave: true,
    can_check_in_out: true,
    can_acknowledge_policies: true,
    can_view_employees: true,
    can_view_all_attendance: true,
    can_view_all_leaves: true,
    can_approve_leaves: true,
    can_view_all_policies: true,
    can_view_policy_compliance: true,
    can_manage_policies: true,
  };
}

export function getPostLoginPath(user: User): string {
  if (user.must_change_password) {
    return '/change-password';
  }
  return getDashboardPath(user.role, user.department);
}

export function getDashboardPath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/dashboard';
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/dashboard';
    case 'MANAGER':
      return '/manager/dashboard';
    case 'EMPLOYEE':
      return '/employee/dashboard';
    case 'FINANCE':
      return '/finance/dashboard';
    default:
      return '/login';
  }
}

export function formatRole(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return 'HR';
  }

  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    HR_ADMIN: 'HR',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
    FINANCE: 'Finance',
  };
  return labels[role];
}

export function getUserDisplayName(user: User | null): string {
  if (!user) {
    return '';
  }
  return user.full_name || user.email;
}

export function getUserInitials(user: User | null): string {
  if (!user) {
    return '?';
  }

  const source = (user.full_name || user.email).trim();
  if (!source) {
    return '?';
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function getRolePermissions(role: UserRole, department?: string | null): RolePermissions {
  if (isHRUser(role, department)) {
    return getHRPermissions();
  }

  const canAccessLeads =
    role === 'SUPER_ADMIN' || (role === 'EMPLOYEE' && isSalesMarketingDepartment(department));

  return {
    ...createEmptyPermissions(),
    can_manage_users: role === 'SUPER_ADMIN',
    can_manage_employees: role === 'SUPER_ADMIN',
    can_view_employees: role === 'SUPER_ADMIN' || role === 'FINANCE',
    can_view_team_employees: role === 'MANAGER',
    can_view_employee_profile: role === 'EMPLOYEE',
    can_approve_payroll: role === 'SUPER_ADMIN' || role === 'FINANCE',
    can_view_admin_dashboard: role === 'SUPER_ADMIN',
    can_access_hr_workspace: role === 'SUPER_ADMIN',
    can_view_hr_dashboard: role === 'SUPER_ADMIN',
    can_view_hr_employees: role === 'SUPER_ADMIN',
    can_manage_hr_employees: role === 'SUPER_ADMIN',
    can_view_hr_offer_letters: role === 'SUPER_ADMIN',
    can_manage_hr_offer_letters: role === 'SUPER_ADMIN',
    can_view_hr_onboarding: role === 'SUPER_ADMIN',
    can_manage_hr_onboarding: role === 'SUPER_ADMIN',
    can_view_hr_leave_management: role === 'SUPER_ADMIN',
    can_view_hr_attendance: role === 'SUPER_ADMIN',
    can_view_hr_policies: role === 'SUPER_ADMIN',
    can_manage_hr_policies: role === 'SUPER_ADMIN',
    can_view_hr_policy_compliance: role === 'SUPER_ADMIN',
    can_view_hr_my_profile: role === 'SUPER_ADMIN',
    can_view_hr_company_settings: role === 'SUPER_ADMIN',
    can_manage_hr_company_settings: role === 'SUPER_ADMIN',
    can_view_manager_dashboard: role === 'MANAGER',
    can_view_finance_dashboard: role === 'FINANCE',
    can_view_employee_dashboard: role === 'EMPLOYEE',
    can_check_in_out: role === 'EMPLOYEE' || role === 'MANAGER',
    can_view_own_attendance: role === 'EMPLOYEE' || role === 'MANAGER',
    can_view_all_attendance: role === 'SUPER_ADMIN',
    can_view_team_attendance: role === 'MANAGER',
    can_manage_attendance: role === 'SUPER_ADMIN',
    can_view_attendance_summary: role === 'SUPER_ADMIN' || role === 'FINANCE',
    can_apply_leave: role === 'EMPLOYEE' || role === 'MANAGER',
    can_view_own_leaves: role === 'EMPLOYEE' || role === 'MANAGER',
    can_view_team_leaves: role === 'MANAGER',
    can_view_all_leaves: role === 'SUPER_ADMIN',
    can_approve_leaves: role === 'SUPER_ADMIN' || role === 'MANAGER',
    can_manage_leave_types: role === 'SUPER_ADMIN',
    can_manage_leave_balances: role === 'SUPER_ADMIN',
    can_view_leave_reports: role === 'SUPER_ADMIN' || role === 'FINANCE',
    can_manage_policies: role === 'SUPER_ADMIN',
    can_view_all_policies: role === 'SUPER_ADMIN',
    can_view_own_policies: role === 'EMPLOYEE' || role === 'MANAGER' || role === 'FINANCE',
    can_acknowledge_policies: role === 'EMPLOYEE' || role === 'MANAGER',
    can_view_policy_compliance: role === 'SUPER_ADMIN',
    can_view_team_policy_compliance: role === 'MANAGER',
    can_view_finance_policies: role === 'FINANCE',
    can_manage_company_settings: role === 'SUPER_ADMIN',
    can_manage_holidays: role === 'SUPER_ADMIN',
    can_delete_employees: role === 'SUPER_ADMIN',
    can_assign_elevated_employee_roles: role === 'SUPER_ADMIN',
    can_manage_salary_structures: role === 'SUPER_ADMIN',
    can_manage_payroll_runs: role === 'SUPER_ADMIN',
    can_manage_payroll_profiles: role === 'SUPER_ADMIN',
    can_view_company_settings: role === 'SUPER_ADMIN' || role === 'MANAGER' || role === 'FINANCE',
    can_view_leads: canAccessLeads,
    can_manage_leads: canAccessLeads,
    can_view_sales_command_center: role === 'SUPER_ADMIN',
  };
}

export function getPoliciesBasePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/policies';
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/policies';
    case 'MANAGER':
      return '/manager/policies';
    case 'FINANCE':
      return '/finance/policies';
    default:
      return '/employee/policies';
  }
}

export function formatPolicyCategory(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAcknowledgementStatus(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getLeavesBasePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/leave-management';
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/leaves';
    case 'MANAGER':
      return '/manager/leaves';
    case 'FINANCE':
      return '/finance/leaves';
    default:
      return '/employee/leaves';
  }
}

export function getHrMyLeavesBasePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/my-leaves';
  }
  return getLeavesBasePath(role, department);
}

export function getHrMyPoliciesBasePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/my-policies';
  }
  if (role === 'MANAGER') {
    return '/manager/policies';
  }
  return '/employee/my-policies';
}

export function getRegularizationPath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/my-regularization';
  }
  if (role === 'MANAGER') {
    return '/manager/leaves/regularization';
  }
  return '/employee/leaves/regularization';
}

export function formatLeaveStatus(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toLowerCase()).replace(/^\w/, (c) => c.toUpperCase());
}

export function getAttendanceBasePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/attendance';
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/attendance';
    case 'MANAGER':
      return '/manager/attendance';
    case 'FINANCE':
      return '/finance/attendance';
    default:
      return '/employee/attendance';
  }
}

export function getHrMyAttendanceBasePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/my-attendance';
  }
  return '/employee/attendance';
}

export function formatWorkMode(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAttendanceStatus(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toLowerCase()).replace(/^\w/, (c) => c.toUpperCase());
}

export function formatTime(value: string | null): string {
  if (!value) {
    return '-';
  }
  const parts = value.split(':');
  if (parts.length < 2) {
    return value;
  }
  const hour = Number(parts[0]);
  const minute = parts[1];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function getEmployeesBasePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/employees';
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/employees';
    case 'MANAGER':
      return '/manager/employees';
    case 'FINANCE':
      return '/finance/employees';
    default:
      return '/employee/profile';
  }
}

export function isHrEmployeesRoute(pathname: string): boolean {
  return pathname.startsWith('/hr/employees');
}

export function canManageEmployeeRecords(
  can: (permission: PermissionKey) => boolean,
  pathname: string,
): boolean {
  if (isHrEmployeesRoute(pathname)) {
    return can('can_manage_hr_employees');
  }
  return can('can_manage_employees');
}

export function getHrMyProfilePath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/my-profile';
  }
  return '/employee/profile';
}

export function formatEmploymentType(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatStatus(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function getLeadsBasePath(role: UserRole): string {
  return role === 'SUPER_ADMIN' ? '/admin/leads' : '/employee/leads';
}

export function getLeadsListPath(role: UserRole): string {
  return `${getLeadsBasePath(role)}/list`;
}

export function getSalesCommandCenterPath(): string {
  return '/admin/sales';
}

export function getLeadsUploadPath(role: UserRole): string {
  return `${getLeadsBasePath(role)}/upload`;
}

export function formatLeadStatus(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatLeadServiceFit(value: string): string {
  const labels: Record<string, string> = {
    ANTRO_WORKFORCE: 'Antro Workforce Services',
    WODENA_TECHNOLOGY: 'Wodena Technology Services',
    IGOLO_INTERIOR: 'Igolo Interior Services',
    TECHNOLOGY_SOLUTIONS: 'Technology Solutions',
  };
  return labels[value] ?? value;
}

export function getUnauthorizedRedirectPath(role: UserRole, department?: string | null): string {
  if (isHRUser(role, department)) {
    return '/hr/dashboard';
  }
  return getDashboardPath(role, department);
}
