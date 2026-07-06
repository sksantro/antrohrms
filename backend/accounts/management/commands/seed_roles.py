from datetime import date

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from employees.models import Employee


class Command(BaseCommand):
    help = 'Reset all data and seed 4 demo users (Super Admin, HR, 2 Employees).'

    DEFAULT_PASSWORD = 'Admin@12345'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write('Flushing all data...')
        call_command('flush', interactive=False, verbosity=0)

        users = [
            {
                'email': 'superadmin@antro.local',
                'full_name': 'Super Admin',
                'phone': '9000000001',
                'role': User.Role.SUPER_ADMIN,
                'is_staff': True,
                'is_superuser': True,
            },
            {
                'email': 'hr@antro.local',
                'full_name': 'HR Admin',
                'phone': '9000000002',
                'role': User.Role.HR_ADMIN,
                'is_staff': True,
            },
            {
                'email': 'sales@antro.local',
                'full_name': 'Sales Employee',
                'phone': '9000000003',
                'role': User.Role.EMPLOYEE,
            },
            {
                'email': 'employee@antro.local',
                'full_name': 'Operations Employee',
                'phone': '9000000004',
                'role': User.Role.EMPLOYEE,
            },
        ]

        created_users = {}
        for data in users:
            user = User.objects.create_user(
                password=self.DEFAULT_PASSWORD,
                must_change_password=False,
                is_active=True,
                **data,
            )
            created_users[user.email] = user
            self.stdout.write(self.style.SUCCESS(f'Created user: {user.email} ({user.role})'))

        sales_user = created_users['sales@antro.local']
        Employee.objects.create(
            user=sales_user,
            employee_code='ANTRO001',
            first_name='Sales',
            last_name='Employee',
            email=sales_user.email,
            phone=sales_user.phone,
            joining_date=date(2025, 1, 15),
            department=Employee.Department.SALES_MARKETING,
            designation='Sales Executive',
            employment_type=Employee.EmploymentType.FULL_TIME,
            status=Employee.Status.ACTIVE,
        )

        ops_user = created_users['employee@antro.local']
        Employee.objects.create(
            user=ops_user,
            employee_code='ANTRO002',
            first_name='Operations',
            last_name='Employee',
            email=ops_user.email,
            phone=ops_user.phone,
            joining_date=date(2025, 3, 1),
            department=Employee.Department.OPERATIONS,
            designation='Operations Executive',
            employment_type=Employee.EmploymentType.FULL_TIME,
            status=Employee.Status.ACTIVE,
        )

        self.stdout.write(self.style.SUCCESS('Created 2 employee profiles.'))
        self.stdout.write(self.style.WARNING(f'Default password for all users: {self.DEFAULT_PASSWORD}'))
        self.stdout.write('')
        self.stdout.write('Accounts:')
        self.stdout.write('  1. superadmin@antro.local  — Super Admin')
        self.stdout.write('  2. hr@antro.local          — HR Admin')
        self.stdout.write('  3. sales@antro.local       — Employee (Sales & Marketing)')
        self.stdout.write('  4. employee@antro.local    — Employee (Operations)')
