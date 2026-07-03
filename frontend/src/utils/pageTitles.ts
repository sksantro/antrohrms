const routeTitles: Array<[string, string]> = [
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
  ['/employee/policies', 'My Policies'],
  ['/employee/attendance', 'My Attendance'],
  ['/employee/profile', 'My Profile'],
  ['/employee/dashboard', 'Dashboard'],
  ['/change-password', 'Change Password'],
];

export function getPageTitle(pathname: string, fallback = 'Antro HRMS'): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';

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
  ['/admin/settings', 'Company profile and HR configuration'],
  ['/manager/dashboard', 'Team overview and pending actions'],
  ['/finance/dashboard', 'Finance and payroll overview'],
  ['/employee/dashboard', 'Your HR self-service overview'],
];

export function getPageSubtitle(pathname: string, fallback = ''): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  for (const [route, subtitle] of routeSubtitles) {
    if (normalized === route || normalized.startsWith(`${route}/`)) {
      return subtitle;
    }
  }

  return fallback;
}
