from datetime import date
from decimal import Decimal

from django.db import transaction

from employees.models import Employee
from leaves.models import LeaveBalance
from settings_app.models import CompanySettings


def get_accrual_months(employee, year: int, up_to: date | None = None) -> int:
    """Count months employee earns 1 paid leave in the given year."""
    if employee.is_intern:
        return 0

    cutoff_day = CompanySettings.get_settings().leave_joining_cutoff_day
    up_to = up_to or date.today()
    if up_to.year < year:
        return 0

    join = employee.joining_date
    start_month = 1
    end_month = 12 if up_to.year > year else up_to.month

    if join.year > year:
        return 0
    if join.year == year:
        if join.day > cutoff_day:
            start_month = join.month + 1
        else:
            start_month = join.month

    if start_month > end_month:
        return 0
    return end_month - start_month + 1


@transaction.atomic
def sync_leave_accrual(employee, year: int | None = None, up_to: date | None = None) -> LeaveBalance:
    """Accrue monthly paid leave up to the current month. No carry forward across years."""
    year = year or date.today().year
    up_to = up_to or date.today()

    balance, _ = LeaveBalance.objects.get_or_create(
        employee=employee,
        year=year,
        defaults={
            'paid_leave_balance': Decimal('0.00'),
            'paid_leave_earned': Decimal('0.00'),
            'paid_leave_used': Decimal('0.00'),
            'lop_days': Decimal('0.00'),
        },
    )

    if employee.is_intern:
        return balance

    months = get_accrual_months(employee, year, up_to)
    expected_earned = Decimal(str(months))
    if balance.paid_leave_earned < expected_earned:
        diff = expected_earned - balance.paid_leave_earned
        balance.paid_leave_earned = expected_earned
        balance.paid_leave_balance += diff
        balance.save(update_fields=['paid_leave_earned', 'paid_leave_balance', 'updated_at'])

    return balance


def get_leave_balance(employee, year: int | None = None) -> LeaveBalance:
    return sync_leave_accrual(employee, year)


def extend_internship(employee, working_days: Decimal):
    if not employee.is_intern:
        return
    days_int = int(working_days.to_integral_value(rounding='ROUND_CEILING'))
    if not employee.original_internship_end_date and employee.internship_end_date:
        employee.original_internship_end_date = employee.internship_end_date
    employee.internship_extended_days += days_int
    if employee.original_internship_end_date:
        from datetime import timedelta
        employee.internship_end_date = (
            employee.original_internship_end_date + timedelta(days=employee.internship_extended_days)
        )
    employee.save(
        update_fields=[
            'original_internship_end_date',
            'internship_extended_days',
            'internship_end_date',
            'updated_at',
        ],
    )
