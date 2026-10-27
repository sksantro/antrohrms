from django.contrib import admin
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from accounts import views as auth
from common import views as common
from employees.views import DepartmentViewSet, EmployeeImportView, EmployeeRolesView, EmployeeViewSet
from payroll.views import CompensationView

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
    path("admin/compensation/<uuid:employee_id>", CompensationView.as_view()),
    path("admin/audit", common.AuditListView.as_view()),
    path("admin/policies", common.PolicyListView.as_view()),
    path("", include("attendance.urls")),
    path("", include(router.urls)),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include(api)),
    re_path(r"^admin/(?P<rest>[\w/-]*)$", common.legacy_admin_redirect),
]
