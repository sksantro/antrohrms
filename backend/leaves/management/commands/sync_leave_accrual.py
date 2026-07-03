from datetime import date

from django.core.management.base import BaseCommand

from employees.models import Employee
from leaves.services.accrual import sync_leave_accrual


class Command(BaseCommand):
    help = 'Sync monthly paid leave accrual for all active non-intern employees.'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, default=date.today().year)

    def handle(self, *args, **options):
        year = options['year']
        count = 0
        for employee in Employee.objects.filter(status=Employee.Status.ACTIVE):
            sync_leave_accrual(employee, year)
            count += 1
        self.stdout.write(self.style.SUCCESS(f'Accrual synced for {count} employees ({year}).'))
