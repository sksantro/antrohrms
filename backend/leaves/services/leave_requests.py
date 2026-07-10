from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from accounts.models import Notification, User
from attendance.models import Attendance
from employees.hr_access import get_hr_users
from leaves.models import LeaveRequest
from leaves.services.accrual import extend_internship, get_leave_balance, sync_leave_accrual
from leaves.services.notifications import (
    notify_employee_leave_status,
    notify_hr_escalation,
    notify_hr_special_approval,
    notify_manager_leave_applied,
    notify_user,
)
from leaves.services.working_days import count_working_days, iter_working_days

ESCALATION_DAYS = 3
BACKDATED_EMPLOYEE_LIMIT = 2
PLANNED_NOTICE_DAYS = 15
MAX_CONTINUOUS_WORKING_DAYS = 5


def has_overlapping_leave(employee, start_date, end_date, exclude_id=None) -> bool:
    queryset = LeaveRequest.objects.filter(
        employee=employee,
        status__in=[
            LeaveRequest.Status.PENDING,
            LeaveRequest.Status.APPROVED,
            LeaveRequest.Status.CANCELLATION_REQUESTED,
        ],
        start_date__lte=end_date,
        end_date__gte=start_date,
    )
    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)
    return queryset.exists()


def compute_paid_and_lop(employee, leave_type, working_days: Decimal, year: int):
    if employee.is_intern:
        return Decimal('0.00'), working_days

    if leave_type == LeaveRequest.LeaveType.UNPAID:
        return Decimal('0.00'), working_days

    balance = sync_leave_accrual(employee, year)
    available = balance.paid_leave_balance
    paid_days = min(available, working_days)
    lop_days = working_days - paid_days
    return paid_days, lop_days


def evaluate_special_approval(leave_type, start_date, working_days: Decimal, today: date | None = None) -> bool:
    today = today or date.today()
    if working_days > MAX_CONTINUOUS_WORKING_DAYS:
        return True
    if leave_type == LeaveRequest.LeaveType.PLANNED:
        notice_days = (start_date - today).days
        if notice_days < PLANNED_NOTICE_DAYS:
            return True
    return False


def validate_backdated_application(start_date, is_hr: bool, today: date | None = None):
    today = today or date.today()
    if start_date >= today:
        return False
    days_back = (today - start_date).days
    if not is_hr and days_back > BACKDATED_EMPLOYEE_LIMIT:
        raise ValueError(
            f'Backdated leave beyond {BACKDATED_EMPLOYEE_LIMIT} days requires HR/Admin regularization.',
        )
    return True


def validate_apply_request(
    employee,
    leave_type,
    start_date,
    end_date,
    half_day=False,
    half_day_session='',
    is_hr=False,
    exclude_id=None,
):
    if end_date < start_date:
        raise ValueError('End date cannot be before start date.')

    if half_day and not half_day_session:
        raise ValueError('Half-day session is required for half-day leave.')

    if has_overlapping_leave(employee, start_date, end_date, exclude_id=exclude_id):
        raise ValueError('You already have a leave request overlapping these dates.')

    is_backdated = validate_backdated_application(start_date, is_hr=is_hr)
    working_days = count_working_days(start_date, end_date, half_day=half_day)
    special = evaluate_special_approval(leave_type, start_date, working_days)
    paid_days, lop_days = compute_paid_and_lop(employee, leave_type, working_days, start_date.year)

    return {
        'total_working_days': working_days,
        'paid_leave_days': paid_days,
        'lop_days': lop_days,
        'is_backdated': is_backdated,
        'is_special_approval_required': special,
    }


def process_escalations():
    cutoff = timezone.now() - timedelta(days=ESCALATION_DAYS)
    pending = LeaveRequest.objects.filter(
        status=LeaveRequest.Status.PENDING,
        escalated_to_hr=False,
        created_at__lte=cutoff,
    )
    for leave_request in pending:
        leave_request.escalated_to_hr = True
        leave_request.escalated_at = timezone.now()
        leave_request.approval_level = LeaveRequest.ApprovalLevel.HR
        leave_request.save(
            update_fields=['escalated_to_hr', 'escalated_at', 'approval_level', 'updated_at'],
        )
        notify_hr_escalation(leave_request)


def can_user_approve_leave(user, leave_request) -> bool:
    if user.is_super_admin or user.is_hr_admin:
        return True

    if leave_request.is_special_approval_required or leave_request.escalated_to_hr:
        return False

    if not user.is_manager:
        return False

    manager_profile = getattr(user, 'employee_profile', None)
    if not manager_profile or leave_request.employee_id == manager_profile.id:
        return False

    return leave_request.employee.reporting_manager_id == manager_profile.id


def can_user_reject_leave(user, leave_request) -> bool:
    if user.is_super_admin or user.is_hr_admin:
        return True
    if leave_request.escalated_to_hr:
        return False
    return can_user_approve_leave(user, leave_request)


def can_user_cancel_pending(user, leave_request) -> bool:
    if leave_request.status != LeaveRequest.Status.PENDING:
        return False
    if user.is_super_admin or user.is_hr_admin:
        return True
    profile = getattr(user, 'employee_profile', None)
    return profile and leave_request.employee_id == profile.id


def can_user_request_cancellation(user, leave_request) -> bool:
    if leave_request.status != LeaveRequest.Status.APPROVED:
        return False
    profile = getattr(user, 'employee_profile', None)
    return profile and leave_request.employee_id == profile.id


def sync_attendance_for_leave(leave_request):
    for day in iter_working_days(leave_request.start_date, leave_request.end_date):
        attendance, _ = Attendance.objects.get_or_create(
            employee=leave_request.employee,
            date=day,
            defaults={
                'status': Attendance.Status.ON_LEAVE,
                'work_mode': Attendance.WorkMode.OFFICE,
            },
        )
        attendance.status = Attendance.Status.ON_LEAVE
        attendance.save(update_fields=['status', 'updated_at'])


def revert_attendance_for_leave(leave_request):
    for day in iter_working_days(leave_request.start_date, leave_request.end_date):
        try:
            attendance = Attendance.objects.get(employee=leave_request.employee, date=day)
            if attendance.status == Attendance.Status.ON_LEAVE:
                attendance.status = Attendance.Status.ABSENT
                attendance.save(update_fields=['status', 'updated_at'])
        except Attendance.DoesNotExist:
            pass


@transaction.atomic
def apply_leave_deductions(leave_request):
    employee = leave_request.employee
    working_days = leave_request.total_working_days

    if employee.is_intern:
        extend_internship(employee, working_days)
        return

    if leave_request.leave_type == LeaveRequest.LeaveType.UNPAID:
        balance = get_leave_balance(employee, leave_request.start_date.year)
        balance.lop_days += working_days
        balance.save(update_fields=['lop_days', 'updated_at'])
        return

    balance = get_leave_balance(employee, leave_request.start_date.year)
    paid = leave_request.paid_leave_days
    lop = leave_request.lop_days
    balance.paid_leave_balance -= paid
    balance.paid_leave_used += paid
    balance.lop_days += lop
    balance.save(
        update_fields=['paid_leave_balance', 'paid_leave_used', 'lop_days', 'updated_at'],
    )


@transaction.atomic
def restore_leave_deductions(leave_request):
    employee = leave_request.employee
    if employee.is_intern:
        days_int = int(leave_request.total_working_days.to_integral_value(rounding='ROUND_CEILING'))
        employee.internship_extended_days = max(0, employee.internship_extended_days - days_int)
        if employee.original_internship_end_date:
            employee.internship_end_date = (
                employee.original_internship_end_date
                + timedelta(days=employee.internship_extended_days)
            )
        employee.save(
            update_fields=['internship_extended_days', 'internship_end_date', 'updated_at'],
        )
        return

    balance = get_leave_balance(employee, leave_request.start_date.year)
    balance.paid_leave_balance += leave_request.paid_leave_days
    balance.paid_leave_used -= leave_request.paid_leave_days
    balance.lop_days -= leave_request.lop_days
    balance.save(
        update_fields=['paid_leave_balance', 'paid_leave_used', 'lop_days', 'updated_at'],
    )


@transaction.atomic
def approve_leave_request(leave_request, approver):
    process_escalations()

    if leave_request.status != LeaveRequest.Status.PENDING:
        raise ValueError('Only pending leave requests can be approved.')

    if not can_user_approve_leave(approver, leave_request):
        if leave_request.is_special_approval_required or leave_request.escalated_to_hr:
            raise ValueError('This leave requires HR/Admin special approval.')
        raise ValueError('You are not allowed to approve this leave request.')

    # Recompute at approval time
    meta = validate_apply_request(
        leave_request.employee,
        leave_request.leave_type,
        leave_request.start_date,
        leave_request.end_date,
        half_day=leave_request.half_day,
        half_day_session=leave_request.half_day_session,
        is_hr=approver.is_super_admin or approver.is_hr_admin,
        exclude_id=leave_request.id,
    )
    leave_request.total_working_days = meta['total_working_days']
    leave_request.paid_leave_days = meta['paid_leave_days']
    leave_request.lop_days = meta['lop_days']

    apply_leave_deductions(leave_request)

    leave_request.status = LeaveRequest.Status.APPROVED
    leave_request.approved_by = approver
    leave_request.approved_at = timezone.now()
    leave_request.rejection_reason = ''
    leave_request.approval_level = (
        LeaveRequest.ApprovalLevel.HR
        if approver.is_super_admin or approver.is_hr_admin
        else LeaveRequest.ApprovalLevel.MANAGER
    )
    leave_request.save()
    sync_attendance_for_leave(leave_request)
    notify_employee_leave_status(leave_request, approved=True)
    return leave_request


@transaction.atomic
def reject_leave_request(leave_request, approver, rejection_reason):
    if leave_request.status != LeaveRequest.Status.PENDING:
        raise ValueError('Only pending leave requests can be rejected.')

    if not can_user_reject_leave(approver, leave_request):
        raise ValueError('You are not allowed to reject this leave request.')

    if not rejection_reason or not rejection_reason.strip():
        raise ValueError('Rejection reason is required.')

    leave_request.status = LeaveRequest.Status.REJECTED
    leave_request.rejected_by = approver
    leave_request.rejected_at = timezone.now()
    leave_request.rejection_reason = rejection_reason.strip()
    leave_request.save()
    notify_employee_leave_status(leave_request, approved=False)
    return leave_request


@transaction.atomic
def cancel_pending_leave(leave_request):
    if leave_request.status != LeaveRequest.Status.PENDING:
        raise ValueError('Only pending leave requests can be cancelled directly.')
    leave_request.status = LeaveRequest.Status.CANCELLED
    leave_request.save()
    return leave_request


@transaction.atomic
def request_leave_cancellation(leave_request):
    if leave_request.status != LeaveRequest.Status.APPROVED:
        raise ValueError('Only approved leave can request cancellation.')
    leave_request.status = LeaveRequest.Status.CANCELLATION_REQUESTED
    leave_request.save()
    hr_users = get_hr_users()
    for hr in hr_users:
        notify_user(
            hr,
            'Leave Cancellation Requested',
            f'{leave_request.employee_name} requested cancellation of approved leave.',
            Notification.Type.LEAVE_CANCELLATION,
            related_id=leave_request.id,
            related_model='LeaveRequest',
        )
    return leave_request


@transaction.atomic
def approve_leave_cancellation(leave_request, approver):
    if leave_request.status != LeaveRequest.Status.CANCELLATION_REQUESTED:
        raise ValueError('No cancellation request pending for this leave.')

    restore_leave_deductions(leave_request)
    revert_attendance_for_leave(leave_request)
    leave_request.status = LeaveRequest.Status.CANCELLED
    leave_request.approved_by = approver
    leave_request.approved_at = timezone.now()
    leave_request.save()
    notify_user(
        leave_request.employee.user,
        'Leave Cancellation Approved',
        'Your leave cancellation request has been approved and balance restored.',
        Notification.Type.LEAVE_CANCELLATION,
        related_id=leave_request.id,
        related_model='LeaveRequest',
    )
    return leave_request


def on_leave_applied(leave_request):
    process_escalations()
    notify_manager_leave_applied(leave_request)
    if leave_request.is_special_approval_required:
        notify_hr_special_approval(leave_request)
