from rest_framework.permissions import BasePermission, SAFE_METHODS

from accounts.models import User


class EmployeePermission(BasePermission):
    """
    - SUPER_ADMIN / HR_ADMIN: full access
    - MANAGER: read team employees only
    - EMPLOYEE: read own profile only
    - FINANCE: read basic employee details only
    """

    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_super_admin or user.is_hr_admin:
            return True

        if request.method in SAFE_METHODS:
            return user.role in {
                User.Role.MANAGER,
                User.Role.EMPLOYEE,
                User.Role.FINANCE,
            }

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.is_super_admin or user.is_hr_admin:
            return True

        if user.is_finance and request.method in SAFE_METHODS:
            return True

        if user.is_employee_user:
            return request.method in SAFE_METHODS and obj.user_id == user.id

        if user.is_manager and request.method in SAFE_METHODS:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                return False
            return (
                obj.reporting_manager_id == manager_profile.id
                or obj.id == manager_profile.id
            )

        return False
