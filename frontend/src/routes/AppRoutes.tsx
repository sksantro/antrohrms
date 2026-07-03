import { Navigate, Route, Routes } from 'react-router-dom';

import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AttendanceCommandCenterPage } from '../pages/attendance/AttendanceCommandCenterPage';
import { AttendanceDetailPage } from '../pages/attendance/AttendanceDetailPage';
import { AttendanceFormPage } from '../pages/attendance/AttendanceFormPage';
import { AttendanceListPage } from '../pages/attendance/AttendanceListPage';
import { AttendanceSummaryPage } from '../pages/attendance/AttendanceSummaryPage';
import { MyAttendancePage } from '../pages/attendance/MyAttendancePage';
import { ApplyLeavePage } from '../pages/leaves/ApplyLeavePage';
import { EscalatedLeaveRequestsPage, LeaveApprovalPage, SpecialApprovalLeavePage } from '../pages/leaves/LeaveApprovalPage';
import { LeaveBalanceManagementPage, LeaveRequestsPage } from '../pages/leaves/LeaveRequestsPage';
import { LeaveManagementCommandCenterPage } from '../pages/leaves/LeaveManagementCommandCenterPage';
import { RegularizationManagementPage, RegularizationRequestPage } from '../pages/leaves/RegularizationPage';
import { LeaveRequestDetailPage } from '../pages/leaves/LeaveRequestDetailPage';
import { MyLeavesPage } from '../pages/leaves/MyLeavesPage';
import { MyPoliciesPage } from '../pages/policies/MyPoliciesPage';
import { PendingAcknowledgementsPage } from '../pages/policies/PendingAcknowledgementsPage';
import { PolicyComplianceSummaryPage } from '../pages/policies/PolicyComplianceSummaryPage';
import { PolicyDetailPage } from '../pages/policies/PolicyDetailPage';
import { PolicyFormPage } from '../pages/policies/PolicyFormPage';
import { CompanySettingsPage } from '../pages/settings/CompanySettingsPage';
import { PolicyListPage } from '../pages/policies/PolicyListPage';
import { SalaryStructureDetailPage } from '../pages/payroll/SalaryStructureDetailPage';
import { SalaryStructureFormPage } from '../pages/payroll/SalaryStructureFormPage';
import { SalaryStructureListPage } from '../pages/payroll/SalaryStructureListPage';
import { PayrollRunDetailPage } from '../pages/payroll/PayrollRunDetailPage';
import { PayrollRunListPage } from '../pages/payroll/PayrollRunListPage';
import { PayrollProfileDetailPage } from '../pages/payroll/PayrollProfileDetailPage';
import { PayrollProfileFormPage } from '../pages/payroll/PayrollProfileFormPage';
import { PayrollProfileListPage } from '../pages/payroll/PayrollProfileListPage';
import { EmployeeDashboardPage } from '../pages/EmployeeDashboardPage';
import { EmployeeDetailPage } from '../pages/employees/EmployeeDetailPage';
import { EmployeeFormPage } from '../pages/employees/EmployeeFormPage';
import { EmployeeListPage } from '../pages/employees/EmployeeListPage';
import { MyProfilePage } from '../pages/employees/MyProfilePage';
import { FinanceDashboardPage } from '../pages/FinanceDashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { ManagerDashboardPage } from '../pages/ManagerDashboardPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { UsersPage } from '../pages/UsersPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RequirePasswordChanged } from './RequirePasswordChanged';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={['SUPER_ADMIN', 'HR_ADMIN']}
            requiredPermission="can_view_admin_dashboard"
          />
        }
      >
        <Route element={<RequirePasswordChanged />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredPermission="can_manage_users">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute requiredPermission="can_view_employees">
                <EmployeeListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_employees">
                <EmployeeFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_employees">
                <EmployeeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_employees">
                <EmployeeFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <ProtectedRoute requiredPermission="can_view_all_attendance">
                <AttendanceCommandCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance/summary"
            element={
              <ProtectedRoute requiredPermission="can_view_attendance_summary">
                <AttendanceSummaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_attendance">
                <AttendanceFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_attendance">
                <AttendanceFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_all_attendance">
                <AttendanceDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves"
            element={
              <ProtectedRoute requiredPermission="can_view_all_leaves">
                <LeaveManagementCommandCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves/requests"
            element={
              <ProtectedRoute requiredPermission="can_view_all_leaves">
                <LeaveRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves/approval"
            element={
              <ProtectedRoute requiredPermission="can_approve_leaves">
                <LeaveApprovalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves/balances"
            element={
              <ProtectedRoute requiredPermission="can_manage_leave_balances">
                <LeaveBalanceManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves/escalated"
            element={
              <ProtectedRoute requiredPermission="can_view_all_leaves">
                <EscalatedLeaveRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves/special-approval"
            element={
              <ProtectedRoute requiredPermission="can_view_all_leaves">
                <SpecialApprovalLeavePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves/regularization"
            element={
              <ProtectedRoute requiredPermission="can_manage_leave_balances">
                <RegularizationManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaves/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_all_leaves">
                <LeaveRequestDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute requiredPermission="can_view_company_settings">
                <CompanySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/salary-structures"
            element={
              <ProtectedRoute requiredPermission="can_manage_salary_structures">
                <SalaryStructureListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/salary-structures/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_salary_structures">
                <SalaryStructureFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/salary-structures/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_salary_structures">
                <SalaryStructureFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/salary-structures/:id"
            element={
              <ProtectedRoute requiredPermission="can_manage_salary_structures">
                <SalaryStructureDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/runs"
            element={
              <ProtectedRoute requiredPermission="can_manage_payroll_runs">
                <PayrollRunListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/runs/:id"
            element={
              <ProtectedRoute requiredPermission="can_manage_payroll_runs">
                <PayrollRunDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/profiles"
            element={
              <ProtectedRoute requiredPermission="can_manage_payroll_profiles">
                <PayrollProfileListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/profiles/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_payroll_profiles">
                <PayrollProfileFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/profiles/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_payroll_profiles">
                <PayrollProfileFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll/profiles/:id"
            element={
              <ProtectedRoute requiredPermission="can_manage_payroll_profiles">
                <PayrollProfileDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/policies"
            element={
              <ProtectedRoute requiredPermission="can_view_all_policies">
                <PolicyListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/policies/compliance"
            element={
              <ProtectedRoute requiredPermission="can_view_policy_compliance">
                <PolicyComplianceSummaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/policies/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_policies">
                <PolicyFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/policies/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_policies">
                <PolicyFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/policies/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_all_policies">
                <PolicyDetailPage />
              </ProtectedRoute>
            }
          />
        </Route>
        </Route>
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={['MANAGER']}
            requiredPermission="can_view_manager_dashboard"
          />
        }
      >
        <Route element={<RequirePasswordChanged />}>
        <Route element={<DashboardLayout />}>
          <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
          <Route
            path="/manager/employees"
            element={
              <ProtectedRoute requiredPermission="can_view_team_employees">
                <EmployeeListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/employees/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_team_employees">
                <EmployeeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/attendance"
            element={
              <ProtectedRoute requiredPermission="can_view_team_attendance">
                <AttendanceListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/attendance/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_team_attendance">
                <AttendanceDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/leaves"
            element={
              <ProtectedRoute requiredPermission="can_view_own_leaves">
                <MyLeavesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/leaves/apply"
            element={
              <ProtectedRoute requiredPermission="can_apply_leave">
                <ApplyLeavePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/leaves/approval"
            element={
              <ProtectedRoute requiredPermission="can_approve_leaves">
                <LeaveApprovalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/leaves/requests"
            element={
              <ProtectedRoute requiredPermission="can_view_team_leaves">
                <LeaveRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/leaves/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_team_leaves">
                <LeaveRequestDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/leaves/regularization"
            element={
              <ProtectedRoute requiredPermission="can_approve_leaves">
                <RegularizationManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/policies"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <MyPoliciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/policies/pending"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <PendingAcknowledgementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/policies/compliance"
            element={
              <ProtectedRoute requiredPermission="can_view_team_policy_compliance">
                <PolicyComplianceSummaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/policies/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <PolicyDetailPage />
              </ProtectedRoute>
            }
          />
        </Route>
        </Route>
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={['FINANCE']}
            requiredPermission="can_view_finance_dashboard"
          />
        }
      >
        <Route element={<RequirePasswordChanged />}>
        <Route element={<DashboardLayout />}>
          <Route path="/finance/dashboard" element={<FinanceDashboardPage />} />
          <Route
            path="/finance/employees"
            element={
              <ProtectedRoute requiredPermission="can_view_employees">
                <EmployeeListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/employees/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_employees">
                <EmployeeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/attendance/summary"
            element={
              <ProtectedRoute requiredPermission="can_view_attendance_summary">
                <AttendanceSummaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/leaves/requests"
            element={
              <ProtectedRoute requiredPermission="can_view_leave_reports">
                <LeaveRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/policies"
            element={
              <ProtectedRoute requiredPermission="can_view_finance_policies">
                <PolicyListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/policies/my"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <MyPoliciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/policies/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_finance_policies">
                <PolicyDetailPage />
              </ProtectedRoute>
            }
          />
        </Route>
        </Route>
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={['EMPLOYEE']}
            requiredPermission="can_view_employee_dashboard"
          />
        }
      >
        <Route element={<RequirePasswordChanged />}>
        <Route element={<DashboardLayout />}>
          <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
          <Route
            path="/employee/profile"
            element={
              <ProtectedRoute requiredPermission="can_view_employee_profile">
                <MyProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/attendance"
            element={
              <ProtectedRoute requiredPermission="can_view_own_attendance">
                <MyAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/attendance/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_own_attendance">
                <AttendanceDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/leaves"
            element={
              <ProtectedRoute requiredPermission="can_view_own_leaves">
                <MyLeavesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/leaves/apply"
            element={
              <ProtectedRoute requiredPermission="can_apply_leave">
                <ApplyLeavePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/leaves/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_own_leaves">
                <LeaveRequestDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/leaves/regularization"
            element={
              <ProtectedRoute requiredPermission="can_view_own_leaves">
                <RegularizationRequestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/policies"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <MyPoliciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/policies/pending"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <PendingAcknowledgementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/policies/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <PolicyDetailPage />
              </ProtectedRoute>
            }
          />
        </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
