"""Create the organization and the first Super Admin on a fresh server.

Usage (on the server, in backend/):  python manage.py bootstrap_admin --email you@company.com --name "Your Name"
The password is typed at a hidden prompt; it is never passed on the command line or stored in plain text.
"""
import getpass
from datetime import date

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Role, RoleAssignment, User
from common.models import OfficeSite, Organization, PolicyVersion
from employees.models import Department, Employee
from employees.services import issue_employee_code

from .seed_demo import DEPARTMENTS, POLICIES


class Command(BaseCommand):
    help = "Create the organization (if missing) and the first Super Admin account."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--name", required=True)
        parser.add_argument("--designation", default="Founder & CEO")

    def handle(self, *args, email, name, designation, **opts):
        email = email.strip().lower()
        if User.objects.filter(email=email).exists():
            raise CommandError(f"{email} already exists.")
        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Repeat password: "):
            raise CommandError("Passwords don't match.")
        try:
            validate_password(password)
        except ValidationError as e:
            raise CommandError(" ".join(e.messages)) from e

        with transaction.atomic():
            org = Organization.objects.first() or create_organization()
            user = User.objects.create_user(email=email, password=password, display_name=name, organization=org)
            for role in (Role.EMPLOYEE, Role.SUPER_ADMIN, Role.REPORTING_MANAGER):
                RoleAssignment.objects.create(user=user, role=role)
            dept = Department.objects.get(organization=org, name="People Ops")
            Employee.objects.create(
                organization=org, user=user, employee_code=issue_employee_code(org), display_name=name,
                official_email=email, department=dept, designation=designation,
                start_date=date.today(), status=Employee.Status.ACTIVE_CONFIRMED,
            )
        self.stdout.write(self.style.SUCCESS(f"Super Admin {email} created. Sign in on the web app, then add your team from People."))


def create_organization() -> Organization:
    org = Organization.objects.create(legal_name="Antro-Pai Technology Pvt. Ltd.", short_name="Antro")
    OfficeSite.objects.create(organization=org, name="Hyderabad office", address="Address to be configured by Super Admin")
    for key, value, status in POLICIES:
        PolicyVersion.objects.create(organization=org, key=key, value=value, status=status, effective_from=date(2026, 1, 1))
    for n in DEPARTMENTS:
        Department.objects.create(organization=org, name=n)
    return org
