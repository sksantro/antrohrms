from django.contrib import admin
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from accounts import views as auth
from common import reports
from common import views as common
from employees.views import AccessView, DirectoryView, DepartmentViewSet, DesignationRuleView, EmployeeImportView, EmployeeRolesView, EmployeeViewSet
from payroll import views as payroll

router = DefaultRouter(trailing_slash=False)
router.register("employees", EmployeeViewSet, basename="employee")
router.register("departments", DepartmentViewSet, basename="department")

api = [
    path("health", common.HealthView.as_view()),
    path("auth/csrf", auth.CsrfView.as_view()),
    path("auth/login", auth.LoginView.as_view()),
    path("auth/logout", auth.LogoutView.as_view()),
    path("auth/me", auth.MeView.as_view()),
    path("auth/activate", auth.ActivateView.as_view()),
    path("auth/change-password", auth.ChangePasswordView.as_view()),
    path("admin/employees/import", EmployeeImportView.as_view()),
    path("admin/employees/<uuid:pk>/roles", EmployeeRolesView.as_view()),
    path("admin/access", AccessView.as_view()),
    path("directory", DirectoryView.as_view()),
    path("admin/access/designation-rules", DesignationRuleView.as_view()),
    path("admin/compensation/<uuid:employee_id>", payroll.CompensationView.as_view()),
    path("admin/payroll/runs", payroll.PayrollRunsView.as_view()),
    path("admin/payroll/runs/<uuid:pk>", payroll.PayrollRunView.as_view()),
    path("admin/payroll/runs/<uuid:pk>/<str:action>", payroll.PayrollRunActionView.as_view()),
    path("admin/payroll/payslips/<uuid:pk>", payroll.PayslipAdjustView.as_view()),
    path("payslips/me", payroll.MyPayslipsView.as_view()),
    path("payslips/<uuid:pk>", payroll.PayslipView.as_view()),
    path("admin/audit", common.AuditListView.as_view()),
    path("notifications", common.NotificationsView.as_view()),
    path("admin/reports/attendance", reports.AttendanceReport.as_view()),
    path("admin/reports/leave", reports.LeaveReport.as_view()),
    path("admin/reports/salary-register", reports.SalaryRegister.as_view()),
    path("admin/policies", common.PolicyListView.as_view()),
    path("", include("attendance.urls")),
    path("", include("leaves.urls")),
    path("", include("recruitment.urls")),
    path("", include("onboarding.urls")),
    path("", include("exits.urls")),
    path("", include("appraisals.urls")),
    path("", include(router.urls)),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include(api)),
    re_path(r"^admin/(?P<rest>[\w/-]*)$", common.legacy_admin_redirect),
]
