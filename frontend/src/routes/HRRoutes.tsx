import { Navigate, Route } from 'react-router-dom';

import { DashboardLayout } from '../layouts/DashboardLayout';
import { AttendanceDetailPage } from '../pages/attendance/AttendanceDetailPage';
import { HRAttendanceViewPage } from '../pages/attendance/HRAttendanceViewPage';
import { MyAttendancePage } from '../pages/attendance/MyAttendancePage';
import { EmployeeDetailPage } from '../pages/employees/EmployeeDetailPage';
import { EmployeeFormPage } from '../pages/employees/EmployeeFormPage';
import { EmployeeListPage } from '../pages/employees/EmployeeListPage';
import { MyProfilePage } from '../pages/employees/MyProfilePage';
import { OnboardingDetailPage } from '../pages/onboarding/OnboardingDetailPage';
import { OnboardingFormPage } from '../pages/onboarding/OnboardingFormPage';
import { OnboardingListPage } from '../pages/onboarding/OnboardingListPage';
import { OfferLetterDetailPage } from '../pages/offer-letters/OfferLetterDetailPage';
import { OfferLetterFormPage } from '../pages/offer-letters/OfferLetterFormPage';
import { OfferLetterListPage } from '../pages/offer-letters/OfferLetterListPage';
import { OfferLetterTemplatePreviewPage } from '../pages/offer-letters/OfferLetterTemplatePreviewPage';
import { ApplyLeavePage } from '../pages/leaves/ApplyLeavePage';
import { HRLeaveManagementPage } from '../pages/leaves/HRLeaveManagementPage';
import { LeaveRequestDetailPage } from '../pages/leaves/LeaveRequestDetailPage';
import { MyLeavesPage } from '../pages/leaves/MyLeavesPage';
import { RegularizationRequestPage } from '../pages/leaves/RegularizationPage';
import { MyPoliciesPage } from '../pages/policies/MyPoliciesPage';
import { PendingAcknowledgementsPage } from '../pages/policies/PendingAcknowledgementsPage';
import { PolicyComplianceSummaryPage } from '../pages/policies/PolicyComplianceSummaryPage';
import { PolicyDetailPage } from '../pages/policies/PolicyDetailPage';
import { PolicyFormPage } from '../pages/policies/PolicyFormPage';
import { PolicyListPage } from '../pages/policies/PolicyListPage';
import { HRCompanySettingsPage } from '../pages/settings/HRCompanySettingsPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RequirePasswordChanged } from './RequirePasswordChanged';

export function HRRoutes() {
  return (
    <Route
      element={
        <ProtectedRoute requiredPermission="can_access_hr_workspace" />
      }
    >
      <Route element={<RequirePasswordChanged />}>
        <Route element={<DashboardLayout />}>
          <Route path="/hr" element={<Navigate to="/hr/dashboard" replace />} />

          <Route
            path="/hr/employees"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_employees">
                <EmployeeListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/employees/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_hr_employees">
                <EmployeeFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/employees/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_hr_employees">
                <EmployeeFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/employees/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_employees">
                <EmployeeDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/offer-letters"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_offer_letters">
                <OfferLetterListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/offer-letters/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_hr_offer_letters">
                <OfferLetterFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/offer-letters/template-preview"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_offer_letters">
                <OfferLetterTemplatePreviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/offer-letters/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_hr_offer_letters">
                <OfferLetterFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/offer-letters/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_offer_letters">
                <OfferLetterDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/onboarding"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_onboarding">
                <OnboardingListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/onboarding/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_hr_onboarding">
                <OnboardingFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/onboarding/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_onboarding">
                <OnboardingDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/policies"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_policies">
                <PolicyListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/policies/new"
            element={
              <ProtectedRoute requiredPermission="can_manage_hr_policies">
                <PolicyFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/policies/:id/edit"
            element={
              <ProtectedRoute requiredPermission="can_manage_hr_policies">
                <PolicyFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/policies/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_policies">
                <PolicyDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/policy-compliance"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_policy_compliance">
                <PolicyComplianceSummaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/policies/compliance"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_policy_compliance">
                <PolicyComplianceSummaryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/leave-management"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_leave_management">
                <HRLeaveManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/leave-management/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_leave_management">
                <LeaveRequestDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/attendance"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_attendance">
                <HRAttendanceViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/attendance/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_attendance">
                <AttendanceDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/company-settings"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_company_settings">
                <HRCompanySettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/my-profile"
            element={
              <ProtectedRoute requiredPermission="can_view_hr_my_profile">
                <MyProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-attendance"
            element={
              <ProtectedRoute requiredPermission="can_view_own_attendance">
                <MyAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-leaves"
            element={
              <ProtectedRoute requiredPermission="can_view_own_leaves">
                <MyLeavesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-leaves/apply"
            element={
              <ProtectedRoute requiredPermission="can_apply_leave">
                <ApplyLeavePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-leaves/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_own_leaves">
                <LeaveRequestDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-policies"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <MyPoliciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-policies/pending"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <PendingAcknowledgementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-policies/:id"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <PolicyDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/policies/pending"
            element={
              <ProtectedRoute requiredPermission="can_view_own_policies">
                <PendingAcknowledgementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/my-regularization"
            element={
              <ProtectedRoute requiredPermission="can_view_own_leaves">
                <RegularizationRequestPage />
              </ProtectedRoute>
            }
          />

        </Route>
      </Route>
    </Route>
  );
}
