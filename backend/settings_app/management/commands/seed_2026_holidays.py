from django.core.management.base import BaseCommand

from settings_app.models import CompanyHoliday

HOLIDAYS_2026 = [
    ('New Year Day', '2026-01-01', CompanyHoliday.HolidayType.COMPANY_HOLIDAY),
    ('Sankranti / Pongal', '2026-01-15', CompanyHoliday.HolidayType.FESTIVAL),
    ('Republic Day', '2026-01-26', CompanyHoliday.HolidayType.NATIONAL_HOLIDAY),
    ('Holi', '2026-03-03', CompanyHoliday.HolidayType.FESTIVAL),
    ('Ugadi', '2026-03-19', CompanyHoliday.HolidayType.FESTIVAL),
    ('Eid-ul-Fitr / Ramzan', '2026-03-21', CompanyHoliday.HolidayType.FESTIVAL),
    ('Good Friday', '2026-04-03', CompanyHoliday.HolidayType.FESTIVAL),
    ('Eid-ul-Adha / Bakrid', '2026-05-28', CompanyHoliday.HolidayType.FESTIVAL),
    ('Independence Day', '2026-08-15', CompanyHoliday.HolidayType.NATIONAL_HOLIDAY),
    ('Vinayaka Chavithi', '2026-09-14', CompanyHoliday.HolidayType.FESTIVAL),
    ('Mahatma Gandhi Jayanti', '2026-10-02', CompanyHoliday.HolidayType.NATIONAL_HOLIDAY),
    ('Vijaya Dasami / Dussehra', '2026-10-20', CompanyHoliday.HolidayType.FESTIVAL),
    ('Deepavali', '2026-11-08', CompanyHoliday.HolidayType.FESTIVAL),
    ('Christmas', '2026-12-25', CompanyHoliday.HolidayType.COMPANY_HOLIDAY),
]


class Command(BaseCommand):
    help = 'Seed the Antro 2026 company holiday list.'

    def handle(self, *args, **options):
        created = 0
        updated = 0

        for name, date_text, holiday_type in HOLIDAYS_2026:
            holiday, was_created = CompanyHoliday.objects.update_or_create(
                date=date_text,
                defaults={
                    'name': name,
                    'holiday_type': holiday_type,
                    'base_holiday_type': holiday_type,
                    'description': '2026 Holiday List',
                    'is_active': True,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'2026 holiday list ready. Created: {created}, updated: {updated}.',
            ),
        )
