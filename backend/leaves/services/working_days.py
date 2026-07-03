from datetime import date, timedelta
from decimal import Decimal

from settings_app.models import CompanyHoliday, CompanySettings


def get_weekly_off_days() -> set[int]:
    settings = CompanySettings.get_settings()
    return set(settings.get_weekly_off_days())


def get_holiday_dates(start: date, end: date) -> set[date]:
    return set(
        CompanyHoliday.objects.filter(
            date__gte=start,
            date__lte=end,
            is_active=True,
        ).values_list('date', flat=True),
    )


def is_working_day(day: date) -> bool:
    if day.weekday() in get_weekly_off_days():
        return False
    return not CompanyHoliday.objects.filter(date=day, is_active=True).exists()


def iter_working_days(start: date, end: date):
    current = start
    while current <= end:
        if is_working_day(current):
            yield current
        current += timedelta(days=1)


def count_working_days(start: date, end: date, half_day: bool = False) -> Decimal:
    if end < start:
        raise ValueError('End date cannot be before start date.')

    if half_day:
        if start != end:
            raise ValueError('Half-day leave must be for a single date.')
        if not is_working_day(start):
            raise ValueError('Selected date is not a working day.')
        return Decimal('0.5')

    days = sum(1 for _ in iter_working_days(start, end))
    if days == 0:
        raise ValueError('No working days in the selected date range.')
    return Decimal(str(days))
