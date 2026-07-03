from decimal import Decimal

from django.db import models


class CompanySettings(models.Model):
    """Singleton-style company configuration."""

    company_name = models.CharField(max_length=255, default='Antro PAI Technology Pvt Ltd')
    office_start_time = models.TimeField(default='09:30:00')
    office_end_time = models.TimeField(default='18:30:00')
    full_day_minimum_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('8.00'),
    )
    half_day_minimum_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('4.00'),
    )
    weekly_off_days = models.JSONField(
        default=list,
        help_text='Weekday numbers (Monday=0) that are weekly offs.',
    )
    financial_year_start_month = models.PositiveSmallIntegerField(default=4)
    leave_joining_cutoff_day = models.PositiveSmallIntegerField(default=15)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Company Settings'
        verbose_name_plural = 'Company Settings'

    def __str__(self):
        return self.company_name or 'Company Settings'

    @classmethod
    def get_settings(cls):
        settings, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                'company_name': 'Antro PAI Technology Pvt Ltd',
                'office_start_time': '09:30:00',
                'office_end_time': '18:30:00',
                'full_day_minimum_hours': Decimal('8.00'),
                'half_day_minimum_hours': Decimal('4.00'),
                'weekly_off_days': [6],
                'financial_year_start_month': 4,
                'leave_joining_cutoff_day': 15,
            },
        )
        if not settings.weekly_off_days:
            settings.weekly_off_days = [6]
            settings.save(update_fields=['weekly_off_days', 'updated_at'])
        return settings

    def get_weekly_off_days(self):
        return self.weekly_off_days or [6]


class CompanyHoliday(models.Model):
    class HolidayType(models.TextChoices):
        COMPANY_HOLIDAY = 'COMPANY_HOLIDAY', 'Company Holiday'
        OPTIONAL_HOLIDAY = 'OPTIONAL_HOLIDAY', 'Optional Holiday'
        FESTIVAL = 'FESTIVAL', 'Festival'
        NATIONAL_HOLIDAY = 'NATIONAL_HOLIDAY', 'National Holiday'

    name = models.CharField(max_length=150)
    date = models.DateField(unique=True)
    holiday_type = models.CharField(
        max_length=30,
        choices=HolidayType.choices,
        default=HolidayType.COMPANY_HOLIDAY,
    )
    base_holiday_type = models.CharField(
        max_length=30,
        choices=HolidayType.choices,
        default=HolidayType.COMPANY_HOLIDAY,
        help_text='Original type restored when optional holiday is turned off.',
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('date',)
        verbose_name_plural = 'company holidays'

    def __str__(self):
        return f'{self.name} ({self.date})'
