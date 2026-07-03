from rest_framework.permissions import BasePermission

from accounts.models import User


class IsSuperAdmin(BasePermission):
    message = 'Super admin access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_super_admin)


class IsHRAdmin(BasePermission):
    message = 'HR admin access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_hr_admin)


class IsManager(BasePermission):
    message = 'Manager access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_manager)


class IsFinance(BasePermission):
    message = 'Finance access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_finance)


class IsEmployee(BasePermission):
    message = 'Employee access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_employee_user)


class IsHRorSuperAdmin(BasePermission):
    message = 'HR admin or super admin access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_super_admin or user.is_hr_admin)
        )


class HasAnyRole(BasePermission):
    """Allow access when the user has one of the configured roles."""

    allowed_roles: set[str] = set()
    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.role == User.Role.SUPER_ADMIN:
            return True
        return user.role in self.allowed_roles
