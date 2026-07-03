from rest_framework.permissions import BasePermission, SAFE_METHODS

from accounts.models import User


class CanManageLeaveBalances(BasePermission):
    message = 'HR admin or super admin access required.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {
                User.Role.SUPER_ADMIN,
                User.Role.HR_ADMIN,
                User.Role.MANAGER,
                User.Role.EMPLOYEE,
                User.Role.FINANCE,
            }
        return user.is_super_admin or user.is_hr_admin


class LeaveRequestPermission(BasePermission):
    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        action = getattr(view, 'action', None)

        if action in ('apply_leave', 'my_balance'):
            return bool(getattr(user, 'employee_profile', None))

        if action in ('apply_leave', 'my_requests', 'cancel', 'request_cancellation'):
            return user.is_employee_user or user.is_manager or user.is_super_admin or user.is_hr_admin

        if action in ('approve', 'reject', 'approve_cancellation'):
            return user.is_super_admin or user.is_hr_admin or user.is_manager

        if user.is_super_admin or user.is_hr_admin:
            return True

        if user.is_finance and request.method in SAFE_METHODS:
            return True

        if action in ('list', 'retrieve') and request.method in SAFE_METHODS:
            return user.is_manager or user.is_employee_user

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        action = getattr(view, 'action', None)

        if user.is_super_admin or user.is_hr_admin:
            return True

        if user.is_finance and request.method in SAFE_METHODS:
            return obj.status == obj.Status.APPROVED

        if action in ('approve', 'reject'):
            from leaves.services import can_user_approve_leave, can_user_reject_leave
            if action == 'approve':
                return can_user_approve_leave(user, obj)
            return can_user_reject_leave(user, obj)

        if action == 'cancel':
            from leaves.services import can_user_cancel_pending
            return can_user_cancel_pending(user, obj)

        if action == 'request_cancellation':
            from leaves.services import can_user_request_cancellation
            return can_user_request_cancellation(user, obj)

        if action == 'approve_cancellation':
            return user.is_super_admin or user.is_hr_admin

        profile = getattr(user, 'employee_profile', None)
        if user.is_employee_user:
            return profile and obj.employee_id == profile.id

        if user.is_manager and request.method in SAFE_METHODS:
            if not profile:
                return False
            return (
                obj.employee_id == profile.id
                or obj.employee.reporting_manager_id == profile.id
            )

        return False
