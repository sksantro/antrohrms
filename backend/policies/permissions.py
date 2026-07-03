from rest_framework.permissions import BasePermission, SAFE_METHODS

from accounts.models import User


class PolicyPermission(BasePermission):
    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        action = getattr(view, 'action', None)

        if action in ('create', 'update', 'partial_update', 'destroy'):
            return user.is_super_admin or user.is_hr_admin

        if action in ('my_policies', 'acknowledge'):
            return bool(getattr(user, 'employee_profile', None))

        if action == 'pending_summary':
            return user.is_super_admin or user.is_hr_admin

        if user.is_super_admin or user.is_hr_admin:
            return True

        if user.is_finance and request.method in SAFE_METHODS:
            return True

        if user.is_manager and request.method in SAFE_METHODS:
            return True

        if user.is_employee_user and request.method in SAFE_METHODS:
            return action in ('list', 'retrieve', 'my_policies')

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        action = getattr(view, 'action', None)

        if user.is_super_admin or user.is_hr_admin:
            return True

        if action == 'acknowledge':
            profile = getattr(user, 'employee_profile', None)
            return profile and obj.is_active

        if user.is_finance and request.method in SAFE_METHODS:
            return True

        if request.method in SAFE_METHODS:
            if not obj.is_active and not (user.is_super_admin or user.is_hr_admin):
                return False
            return True

        return False


class AcknowledgementPermission(BasePermission):
    message = 'You do not have permission to view acknowledgements.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_super_admin or user.is_hr_admin:
            return True

        if user.is_manager:
            return True

        if user.is_finance:
            return True

        return False
