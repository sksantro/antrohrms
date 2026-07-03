from rest_framework.permissions import BasePermission


class IsSuperAdminSalaryAccess(BasePermission):
    message = 'Super admin access required for salary structure management.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_super_admin)


class IsEmployeeOwnSalaryAccess(BasePermission):
    message = 'Employee access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_employee_user)


class IsSuperAdminPayrollRunAccess(BasePermission):
    message = 'Super admin access required for payroll run management.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_super_admin)


class IsSuperAdminPayrollProfileAccess(BasePermission):
    message = 'Super admin access required for payroll profile management.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_super_admin)
