import type { User } from '../types';
import { isHRDepartment, isSalesMarketingDepartment } from './rbac';

const LEAD_DETAIL_PATH = /^\/(admin|employee)\/leads\/\d+$/;
const SALES_EMPLOYEE_DETAIL_PATH = /^\/admin\/sales\/employees\/\d+$/;

const routeTitles: Array<[string, string]> = [
  ['/hr/my-regularization', 'My Regularization'],
  ['/hr/my-policies/pending', 'Pending Acknowledgements'],
  ['/hr/my-policies', 'My Policies'],
  ['/hr/my-leaves/apply', 'Apply Leave'],
  ['/hr/my-leaves', 'My Leaves'],
  ['/hr/my-attendance', 'My Attendance'],
  ['/hr/my-profile', 'My Profile'],
  ['/hr/attendance', 'Attendance View'],
  ['/hr/company-settings', 'HR Settings'],
  ['/hr/leave-management', 'Leave Management'],
  ['/hr/policy-compliance', 'Policy Compliance'],
  ['/hr/policies/compliance', 'Policy Compliance'],
  ['/hr/policies/new', 'Create Policy'],
  ['/hr/policies', 'Policies'],
  ['/hr/onboarding/new', 'Create Onboarding'],
  ['/hr/onboarding', 'Onboarding'],
  ['/hr/offer-letters/new', 'Create Offer Letter'],
  ['/hr/offer-letters', 'Offer Letters'],
  ['/hr/employees/new', 'Add Employee'],
  ['/hr/employees', 'Employee Management'],
  ['/hr/dashboard', 'HR Dashboard'],
  ['/admin/payroll/profiles/new', 'Add Payroll Profile'],
  ['/admin/payroll/profiles', 'Payroll Profiles'],
  ['/admin/payroll/runs', 'Payroll Runs'],
  ['/admin/payroll/salary-structures/new', 'Add Salary Structure'],
  ['/admin/payroll/salary-structures', 'Salary Structures'],
  ['/admin/leaves/special-approval', 'Special Approval'],
  ['/admin/leaves/escalated', 'Escalated Leaves'],
  ['/admin/leaves/regularization', 'Regularization'],
  ['/admin/leaves/balances', 'Leave Balance'],
  ['/admin/leaves/approval', 'Leave Approval'],
  ['/admin/leaves/requests', 'Leave Requests'],
  ['/admin/attendance/summary', 'Attendance Summary'],
  ['/admin/settings', 'Company Settings'],
  ['/admin/policies/compliance', 'Policy Compliance'],
  ['/admin/policies/new', 'Create Policy'],
  ['/admin/policies', 'Policies'],
  ['/admin/leads/upload', 'Bulk Lead Upload'],
  ['/admin/leads/list', 'All Leads'],
  ['/admin/leads', 'Lead Dashboard'],
  ['/admin/sales', 'Sales Command Center'],
  ['/admin/employees/new', 'Add Employee'],
  ['/admin/attendance/new', 'Add Attendance'],
  ['/admin/attendance', 'Attendance'],
  ['/admin/employees', 'Employees'],
  ['/admin/users', 'Users'],
  ['/admin/dashboard', 'Dashboard'],
  ['/manager/leaves/regularization', 'Team Regularization'],
  ['/manager/leaves/requests', 'Team Leave Requests'],
  ['/manager/leaves/approval', 'Leave Approval'],
  ['/manager/policies/compliance', 'Team Policy Compliance'],
  ['/manager/policies/pending', 'Pending Acknowledgements'],
  ['/manager/policies', 'My Policies'],
  ['/manager/attendance', 'Team Attendance'],
  ['/manager/employees', 'Team Employees'],
  ['/manager/leaves', 'My Leaves'],
  ['/manager/dashboard', 'Dashboard'],
  ['/finance/leaves/requests', 'Leave Reports'],
  ['/finance/attendance/summary', 'Attendance Summary'],
  ['/finance/policies/my', 'My Policy Acknowledgements'],
  ['/finance/policies', 'Policies'],
  ['/finance/employees', 'Employees'],
  ['/finance/dashboard', 'Dashboard'],
  ['/employee/leaves/regularization', 'Regularization'],
  ['/employee/leaves/apply', 'Apply Leave'],
  ['/employee/leaves', 'My Leaves'],
  ['/employee/policies/pending', 'Pending Acknowledgements'],
  ['/employee/my-policies/pending', 'Pending Acknowledgements'],
  ['/employee/policies', 'My Policies'],
  ['/employee/my-policies', 'My Policies'],
  ['/employee/attendance', 'My Attendance'],
  ['/employee/profile', 'My Profile'],
  ['/employee/leads/upload', 'Bulk Lead Upload'],
  ['/employee/leads/list', 'All Leads'],
  ['/employee/leads', 'Lead Dashboard'],
  ['/employee/dashboard', 'Dashboard'],
  ['/change-password', 'Change Password'],
];

export function getPageTitle(pathname: string, user?: User | null, fallback = 'Antro HRMS'): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (LEAD_DETAIL_PATH.test(normalized)) {
    return 'Lead Details';
  }

  if (SALES_EMPLOYEE_DETAIL_PATH.test(normalized)) {
    return 'Sales Employee Detail';
  }

  if (normalized === '/employee/dashboard' && isSalesMarketingDepartment(user?.department)) {
    return 'Sales & Marketing Dashboard';
  }

  if (normalized === '/employee/dashboard' && isHRDepartment(user?.department)) {
    return 'HR Dashboard';
  }

  if (normalized === '/hr/dashboard') {
    return 'HR Dashboard';
  }

  for (const [route, title] of routeTitles) {
    if (normalized === route || normalized.startsWith(`${route}/`)) {
      return title;
    }
  }

  if (normalized.includes('/new')) return 'Create';
  if (normalized.includes('/edit')) return 'Edit';

  return fallback;
}

const routeSubtitles: Array<[string, string]> = [
  ['/hr/dashboard', 'People operations, policies, leave, and attendance overview'],
  ['/hr/employees', 'Employee records and company details'],
  ['/hr/offer-letters', 'Offer letter generation and tracking'],
  ['/hr/onboarding', 'New hire onboarding workflows'],
  ['/hr/policies', 'Company policies and acknowledgements'],
  ['/hr/policy-compliance', 'Policy acknowledgement tracking'],
  ['/hr/policies/compliance', 'Policy acknowledgement tracking'],
  ['/hr/leave-management', 'Review and manage leave requests'],
  ['/hr/attendance', 'Track and monitor company attendance'],
  ['/hr/company-settings', 'HR master data: departments, leave types, holidays, and categories'],
  ['/hr/my-profile', 'Your employee profile and details'],
  ['/hr/my-attendance', 'Your attendance history and check-ins'],
  ['/hr/my-leaves', 'Your leave requests and balances'],
  ['/hr/my-policies', 'Policies assigned to you'],
  ['/hr/my-regularization', 'Request attendance corrections'],
  ['/admin/dashboard', 'Company-wide HRMS overview'],
  ['/admin/users', 'Manage system users and access'],
  ['/admin/employees', 'Employee records and lifecycle'],
  ['/admin/attendance/summary', 'Attendance insights across the company'],
  ['/admin/attendance', 'Track and manage attendance records'],
  ['/admin/leaves/requests', 'Review and manage leave requests'],
  ['/admin/leaves/approval', 'Approve or reject pending leave requests'],
  ['/admin/leaves/balances', 'Manage employee leave balances'],
  ['/admin/leaves/escalated', 'Review escalated leave cases'],
  ['/admin/leaves/special-approval', 'Handle special leave approvals'],
  ['/admin/leaves/regularization', 'Attendance regularization requests'],
  ['/admin/payroll/salary-structures', 'Confidential salary component setup'],
  ['/admin/payroll/runs', 'Monthly payroll draft and lock workflow'],
  ['/admin/payroll/profiles', 'Employee bank and statutory details'],
  ['/admin/policies/compliance', 'Policy acknowledgement tracking'],
  ['/admin/policies', 'Company policies and acknowledgements'],
  ['/admin/leads/list', 'Search, filter, and manage company leads'],
  ['/admin/leads', 'Sales pipeline overview and recent leads'],
  ['/admin/sales', 'Team KPI visibility, checkout status, and sales performance'],
  ['/admin/settings', 'Company profile and HR configuration'],
  ['/manager/dashboard', 'Team overview and pending actions'],
  ['/finance/dashboard', 'Finance and payroll overview'],
  ['/employee/dashboard', 'Your HR self-service overview'],
  ['/employee/leads/list', 'Search, filter, and manage your company leads'],
  ['/employee/leads', 'Pipeline overview and recently updated leads'],
];

export function getPageSubtitle(pathname: string, user?: User | null, fallback = ''): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (LEAD_DETAIL_PATH.test(normalized)) {
    return 'Company profile, contacts, and activity history';
  }

  if (SALES_EMPLOYEE_DETAIL_PATH.test(normalized)) {
    return 'KPI progress, leads, activities, and checkout report';
  }

  if (normalized === '/employee/dashboard' && isSalesMarketingDepartment(user?.department)) {
    return 'Daily KPIs, leads, and sales workflow overview';
  }

  if (normalized === '/employee/dashboard' && isHRDepartment(user?.department)) {
    return 'People operations, policies, leave, and attendance overview';
  }

  if (normalized === '/hr/dashboard') {
    return 'People operations, policies, leave, and attendance overview';
  }

  for (const [route, subtitle] of routeSubtitles) {
    if (normalized === route || normalized.startsWith(`${route}/`)) {
      return subtitle;
    }
  }

  return fallback;
}
