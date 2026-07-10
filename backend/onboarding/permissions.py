from rest_framework.permissions import BasePermission, IsAuthenticated

from employees.hr_access import user_has_hr_access


class OnboardingPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_super_admin or user_has_hr_access(user):
            return True
        if getattr(view, 'allow_employee_self', False):
            return hasattr(user, 'employee_profile')
        return False


class OnboardingEmployeePermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and hasattr(user, 'employee_profile'),
        )
