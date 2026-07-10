from rest_framework.permissions import BasePermission, SAFE_METHODS

from accounts.models import User


class AttendancePermission(BasePermission):
    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        action = getattr(view, 'action', None)

        if action in ('check_in', 'check_out'):
            return user.is_employee_user or user.is_manager

        if action == 'my':
            return user.is_employee_user or user.is_manager

        if action == 'summary':
            return user.is_super_admin or user.is_hr_admin or user.is_finance

        if user.is_super_admin or user.is_hr_admin:
            # HR may view attendance records only; create/update gated by CanManageAttendance.
            if request.method in SAFE_METHODS:
                return True
            return user.is_super_admin

        if action in ('list', 'retrieve') and request.method in SAFE_METHODS:
            return user.role in {User.Role.MANAGER, User.Role.FINANCE}

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.is_super_admin:
            return True

        if user.is_hr_admin and request.method in SAFE_METHODS:
            return True

        if user.is_finance and request.method in SAFE_METHODS:
            return True

        if user.is_employee_user:
            profile = getattr(user, 'employee_profile', None)
            return profile and obj.employee_id == profile.id

        if user.is_manager and request.method in SAFE_METHODS:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                return False
            return obj.employee.reporting_manager_id == manager_profile.id

        return False


class CanManageAttendance(BasePermission):
    message = 'Super admin access required to create or edit attendance.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_super_admin)
