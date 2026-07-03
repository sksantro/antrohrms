from datetime import date

from django.core.management.base import BaseCommand

from accounts.models import User
from employees.models import Employee


class Command(BaseCommand):
    help = 'Seed default users for each role (development only).'

    def handle(self, *args, **options):
        users = [
            {
                'email': 'superadmin@antro.local',
                'full_name': 'Super Admin',
                'phone': '9000000001',
                'role': User.Role.SUPER_ADMIN,
                'password': 'Admin@12345',
                'is_staff': True,
                'is_superuser': True,
            },
            {
                'email': 'hr@antro.local',
                'full_name': 'HR Admin',
                'phone': '9000000002',
                'role': User.Role.HR_ADMIN,
                'password': 'Admin@12345',
                'is_staff': True,
            },
            {
                'email': 'manager@antro.local',
                'full_name': 'Team Manager',
                'phone': '9000000003',
                'role': User.Role.MANAGER,
                'password': 'Admin@12345',
                'is_staff': False,
            },
            {
                'email': 'employee@antro.local',
                'full_name': 'Demo Employee',
                'phone': '9000000004',
                'role': User.Role.EMPLOYEE,
                'password': 'Admin@12345',
            },
            {
                'email': 'finance@antro.local',
                'full_name': 'Finance User',
                'phone': '9000000005',
                'role': User.Role.FINANCE,
                'password': 'Admin@12345',
                'is_staff': True,
            },
        ]

        created_users = {}
        for data in users:
            password = data.pop('password')
            email = data['email']
            user, created = User.objects.update_or_create(
                email=email,
                defaults=data,
            )
            user.set_password(password)
            user.must_change_password = False
            user.save()
            created_users[email] = user

            action = 'Created' if created else 'Updated'
            self.stdout.write(self.style.SUCCESS(f'{action} user: {user.email} ({user.role})'))

        manager_user = created_users['manager@antro.local']
        employee_user = created_users['employee@antro.local']

        manager_employee, _ = Employee.objects.update_or_create(
            user=manager_user,
            defaults={
                'employee_code': 'ANTRO001',
                'first_name': 'Team',
                'last_name': 'Manager',
                'email': manager_user.email,
                'phone': manager_user.phone,
                'joining_date': date(2024, 1, 1),
                'department': 'Operations',
                'designation': 'Manager',
                'employment_type': Employee.EmploymentType.FULL_TIME,
                'status': Employee.Status.ACTIVE,
            },
        )

        Employee.objects.update_or_create(
            user=employee_user,
            defaults={
                'employee_code': 'ANTRO002',
                'first_name': 'Demo',
                'last_name': 'Employee',
                'email': employee_user.email,
                'phone': employee_user.phone,
                'joining_date': date(2024, 6, 1),
                'department': 'Operations',
                'designation': 'Executive',
                'reporting_manager': manager_employee,
                'employment_type': Employee.EmploymentType.FULL_TIME,
                'status': Employee.Status.ACTIVE,
            },
        )

        self.stdout.write(self.style.SUCCESS('Seeded demo employee profiles for manager and employee.'))
        self.stdout.write(self.style.WARNING('Default password for all seeded users: Admin@12345'))
