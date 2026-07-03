from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone

from settings_app.models import CompanySettings


def get_today():
    return timezone.localdate()


def combine_local(date_value, time_value):
    tz = timezone.get_current_timezone()
    return timezone.make_aware(datetime.combine(date_value, time_value), tz)


def calculate_late_minutes(check_in_time, company_start_time):
    if not check_in_time or not company_start_time:
        return 0
    if check_in_time <= company_start_time:
        return 0
    today = get_today()
    start_dt = combine_local(today, company_start_time)
    check_in_dt = combine_local(today, check_in_time)
    delta = check_in_dt - start_dt
    return max(int(delta.total_seconds() // 60), 0)


def calculate_total_work_hours(check_in_time, check_out_time):
    if not check_in_time or not check_out_time:
        return Decimal('0.00')
    today = get_today()
    check_in_dt = combine_local(today, check_in_time)
    check_out_dt = combine_local(today, check_out_time)
    if check_out_dt <= check_in_dt:
        return Decimal('0.00')
    delta: timedelta = check_out_dt - check_in_dt
    hours = Decimal(delta.total_seconds()) / Decimal('3600')
    return hours.quantize(Decimal('0.01'))


def resolve_status(late_minutes, has_check_in, has_check_out, total_work_hours=None):
    from attendance.models import Attendance

    settings = CompanySettings.get_settings()
    full_day_min = float(settings.full_day_minimum_hours)
    half_day_min = float(settings.half_day_minimum_hours)

    if not has_check_in:
        return Attendance.Status.ABSENT
    if has_check_in and not has_check_out:
        return Attendance.Status.MISSING_CHECKOUT

    hours = float(total_work_hours or 0)
    if hours >= full_day_min:
        return Attendance.Status.LATE if late_minutes > 0 else Attendance.Status.PRESENT
    if hours >= half_day_min:
        return Attendance.Status.HALF_DAY
    return Attendance.Status.ABSENT


def get_company_start_time():
    return CompanySettings.get_settings().office_start_time
