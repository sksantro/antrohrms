from datetime import date, datetime

from django.db import transaction
from django.utils import timezone

from attendance.models import Attendance, AttendanceRegularization
from attendance.services import (
    calculate_late_minutes,
    calculate_total_work_hours,
    combine_local,
    get_company_start_time,
    resolve_status,
)
from leaves.services.notifications import notify_regularization_applied, notify_user
from accounts.models import Notification

BACKDATED_EMPLOYEE_LIMIT = 2


def validate_regularization_date(reg_date: date, is_hr: bool):
    today = date.today()
    if reg_date > today:
        raise ValueError('Cannot request regularization for a future date.')
    days_back = (today - reg_date).days
    is_backdated = days_back > 0
    if is_backdated and not is_hr and days_back > BACKDATED_EMPLOYEE_LIMIT:
        raise ValueError(
            f'Regularization beyond {BACKDATED_EMPLOYEE_LIMIT} days requires HR/Admin approval.',
        )
    return is_backdated


def can_approve_regularization(user, regularization):
    # Regularization approval/rejection is Super Admin only.
    return bool(user and user.is_authenticated and user.is_super_admin)


@transaction.atomic
def approve_regularization(regularization, approver):
    if regularization.status != AttendanceRegularization.Status.PENDING:
        raise ValueError('Only pending regularization requests can be approved.')
    if not can_approve_regularization(approver, regularization):
        raise ValueError('You are not allowed to approve this regularization.')

    company_start = get_company_start_time()
    late_minutes = calculate_late_minutes(regularization.requested_check_in, company_start)

    today = regularization.date
    check_in_dt = combine_local(today, regularization.requested_check_in) if regularization.requested_check_in else None
    check_out_dt = combine_local(today, regularization.requested_check_out) if regularization.requested_check_out else None

    total_hours = 0
    if check_in_dt and check_out_dt and check_out_dt > check_in_dt:
        from decimal import Decimal
        delta = check_out_dt - check_in_dt
        total_hours = (Decimal(delta.total_seconds()) / Decimal('3600')).quantize(Decimal('0.01'))

    attendance, _ = Attendance.objects.get_or_create(
        employee=regularization.employee,
        date=regularization.date,
        defaults={'work_mode': Attendance.WorkMode.OFFICE},
    )
    attendance.check_in_time = regularization.requested_check_in
    attendance.check_out_time = regularization.requested_check_out
    attendance.total_work_hours = total_hours
    attendance.late_minutes = late_minutes
    attendance.status = resolve_status(
        late_minutes,
        bool(regularization.requested_check_in),
        bool(regularization.requested_check_out),
        total_hours,
    )
    attendance.remarks = f'Regularized: {regularization.reason}'
    attendance.save()

    regularization.status = AttendanceRegularization.Status.APPROVED
    regularization.approved_by = approver
    regularization.approved_at = timezone.now()
    regularization.save()

    notify_user(
        regularization.employee.user,
        'Regularization Approved',
        f'Your attendance regularization for {regularization.date} was approved.',
        Notification.Type.REGULARIZATION_APPROVED,
        related_id=regularization.id,
        related_model='AttendanceRegularization',
    )
    return regularization


@transaction.atomic
def reject_regularization(regularization, approver, rejection_reason):
    if regularization.status != AttendanceRegularization.Status.PENDING:
        raise ValueError('Only pending regularization requests can be rejected.')
    if not can_approve_regularization(approver, regularization):
        raise ValueError('You are not allowed to reject this regularization.')
    if not rejection_reason or not rejection_reason.strip():
        raise ValueError('Rejection reason is required.')

    regularization.status = AttendanceRegularization.Status.REJECTED
    regularization.rejected_by = approver
    regularization.rejected_at = timezone.now()
    regularization.rejection_reason = rejection_reason.strip()
    regularization.save()

    notify_user(
        regularization.employee.user,
        'Regularization Rejected',
        f'Your attendance regularization for {regularization.date} was rejected.',
        Notification.Type.REGULARIZATION_REJECTED,
        related_id=regularization.id,
        related_model='AttendanceRegularization',
    )
    return regularization
