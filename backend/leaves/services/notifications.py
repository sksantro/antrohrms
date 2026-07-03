from accounts.models import Notification, User
from employees.models import Employee


def notify_user(user, title, message, notification_type, related_id=None, related_model=''):
    if not user:
        return
    Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        related_id=related_id,
        related_model=related_model,
    )


def notify_manager_leave_applied(leave_request):
    manager = leave_request.employee.reporting_manager
    if not manager or not manager.user:
        return
    notify_user(
        manager.user,
        'New Leave Request',
        f'{leave_request.employee_name} applied for {leave_request.leave_type} leave '
        f'from {leave_request.start_date} to {leave_request.end_date}.',
        Notification.Type.LEAVE_APPLIED,
        related_id=leave_request.id,
        related_model='LeaveRequest',
    )


def notify_employee_leave_status(leave_request, approved: bool):
    user = leave_request.employee.user
    if approved:
        notify_user(
            user,
            'Leave Approved',
            f'Your {leave_request.leave_type} leave ({leave_request.start_date} to '
            f'{leave_request.end_date}) has been approved.',
            Notification.Type.LEAVE_APPROVED,
            related_id=leave_request.id,
            related_model='LeaveRequest',
        )
    else:
        notify_user(
            user,
            'Leave Rejected',
            f'Your {leave_request.leave_type} leave was rejected. Reason: '
            f'{leave_request.rejection_reason}',
            Notification.Type.LEAVE_REJECTED,
            related_id=leave_request.id,
            related_model='LeaveRequest',
        )


def notify_hr_escalation(leave_request):
    hr_users = User.objects.filter(role__in=[User.Role.HR_ADMIN, User.Role.SUPER_ADMIN], is_active=True)
    for hr in hr_users:
        notify_user(
            hr,
            'Leave Escalated',
            f'Leave request from {leave_request.employee_name} has been escalated after 3 days '
            f'without manager action.',
            Notification.Type.LEAVE_ESCALATED,
            related_id=leave_request.id,
            related_model='LeaveRequest',
        )


def notify_hr_special_approval(leave_request):
    hr_users = User.objects.filter(role__in=[User.Role.HR_ADMIN, User.Role.SUPER_ADMIN], is_active=True)
    for hr in hr_users:
        notify_user(
            hr,
            'Special Approval Required',
            f'Leave request from {leave_request.employee_name} requires HR special approval.',
            Notification.Type.LEAVE_APPLIED,
            related_id=leave_request.id,
            related_model='LeaveRequest',
        )


def notify_regularization_applied(regularization):
    manager = regularization.employee.reporting_manager
    if manager and manager.user:
        notify_user(
            manager.user,
            'Attendance Regularization',
            f'{regularization.employee_name} requested attendance regularization for {regularization.date}.',
            Notification.Type.REGULARIZATION_APPLIED,
            related_id=regularization.id,
            related_model='AttendanceRegularization',
        )
