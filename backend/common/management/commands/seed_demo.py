"""Seed a synthetic organization for local development (BRD §20.1: synthetic data only).

Usage: python manage.py seed_demo    (requires DJANGO_DEBUG=true and SEED_DEMO_PASSWORD)
"""
import os
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Role, RoleAssignment, User
from common.models import Organization, PolicyVersion
from employees.models import Department, Employee
from employees.services import issue_employee_code
from payroll.models import SalaryVersion

S = PolicyVersion.Status
POLICIES = [
    ("attendance.workdays", ["MON", "TUE", "WED", "THU", "FRI"], S.APPROVED),
    ("attendance.required_work_seconds", 28800, S.APPROVED),
    ("attendance.required_presence_seconds", 32400, S.APPROVED),
    ("attendance.office_window", {"start": "09:30", "end": "18:30"}, S.REQUIRES_ADMIN_CONFIGURATION),
    ("breaks.tea", {"remind_min": 10, "exceed_min": 15, "max_count": None}, S.APPROVED),
    ("breaks.lunch", {"min_min": 30, "remind_min": 40, "exceed_min": 45}, S.APPROVED),
    ("breaks.admin_escalation_after_min", 5, S.APPROVED),
    ("geofence.radius_m", 50, S.APPROVED),
    ("geofence.reverify_interval_min", 15, S.APPROVED),
    ("geofence.location_retention_days", 30, S.REQUIRES_LEGAL_REVIEW),
    ("leave.quotas", {"CL": 12, "SL": 12, "EL": 15}, S.REQUIRES_LEGAL_REVIEW),
    ("holidays.optional", {"published": 4, "per_employee": 2}, S.APPROVED),
    ("probation.months", 3, S.APPROVED),
    ("probation.reminder_days", 15, S.APPROVED),
    ("payroll.pt_telangana", [{"upto": 15000, "pt": 0}, {"upto": 20000, "pt": 150}, {"upto": None, "pt": 200}], S.APPROVED),
    ("payroll.pf_enabled", False, S.REQUIRES_LEGAL_REVIEW),
    ("payroll.tds_enabled", False, S.REQUIRES_LEGAL_REVIEW),
    ("compoff.rates", {"full_day_hours": 8, "half_day_hours": 4}, S.REQUIRES_LEGAL_REVIEW),
]

# name, email-local, designation, department, manager email-local, start, status, extra roles, monthly gross
PEOPLE = [
    ("Aarav Mehta", "aarav", "Founder & CEO", "People Ops", None, "2022-04-01", "ACTIVE_CONFIRMED", [Role.SUPER_ADMIN, Role.REPORTING_MANAGER], 120000),
    ("Riya Sharma", "riya", "HR Executive", "People Ops", "aarav", "2023-07-10", "ACTIVE_CONFIRMED", [Role.HR_OPERATIONS], 38000),
    ("Kabir Rao", "kabir", "Senior Frontend Engineer", "Engineering", "aarav", "2023-01-16", "ACTIVE_CONFIRMED", [Role.REPORTING_MANAGER, Role.INTERVIEWER], 85000),
    ("Ananya Iyer", "ananya", "Product Designer", "Design", "kabir", "2024-02-05", "ACTIVE_CONFIRMED", [], 52000),
    ("Vihaan Gupta", "vihaan", "Backend Engineer", "Engineering", "kabir", "2024-06-03", "ACTIVE_CONFIRMED", [Role.INTERVIEWER], 60000),
    ("Meera Nair", "meera", "Sales Manager", "Sales", "aarav", "2024-08-19", "ACTIVE_CONFIRMED", [Role.REPORTING_MANAGER], 72000),
    ("Arjun Reddy", "arjun", "Pre-sales Consultant", "Pre-sales", "meera", "2025-01-06", "ACTIVE_CONFIRMED", [], 48000),
    ("Saanvi Joshi", "saanvi", "QA Engineer", "Engineering", "kabir", "2025-03-10", "ACTIVE_CONFIRMED", [], 42000),
    ("Ishaan Verma", "ishaan", "Sales Executive", "Sales", "meera", "2025-07-01", "ACTIVE_CONFIRMED", [], 30000),
    ("Diya Kapoor", "diya", "UI Engineer", "Engineering", "kabir", "2026-09-15", "PROBATION", [], 30000),
    ("Rohan Das", "rohan", "DevOps Engineer", "Engineering", "kabir", "2026-10-06", "PROBATION", [], 55000),
    ("Tara Menon", "tara", "Business Analyst", "Pre-sales", "meera", "2025-05-12", "NOTICE_PERIOD", [], 40000),
]
DEPARTMENTS = ["Engineering", "Design", "Sales", "Pre-sales", "People Ops"]
DOMAIN = "antropai.example"  # reserved example domain — never a real mailbox


def split(gross: int) -> list[dict]:
    basic, hra = gross // 2, gross // 5
    return [
        {"code": "BASIC", "name": "Basic", "type": "EARNING", "amount": f"{basic}.00"},
        {"code": "HRA", "name": "House Rent Allowance", "type": "EARNING", "amount": f"{hra}.00"},
        {"code": "SPL", "name": "Special Allowance", "type": "EARNING", "amount": f"{gross - basic - hra}.00"},
    ]


class Command(BaseCommand):
    help = "Create a synthetic Antro organization with demo users (development only)."

    @transaction.atomic
    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("seed_demo only runs with DJANGO_DEBUG=true.")
        password = os.environ.get("SEED_DEMO_PASSWORD")
        if not password:
            raise CommandError("Set SEED_DEMO_PASSWORD in backend/.env first.")
        if Organization.objects.exists():
            self.stdout.write("Organization already exists — nothing to do.")
            return

        from .bootstrap_admin import create_organization

        org = create_organization()
        depts = {d.name: d for d in Department.objects.filter(organization=org)}

        emps: dict[str, Employee] = {}
        admin_user = None
        for name, local, title, dept, mgr, start, status, roles, gross in PEOPLE:
            user = User.objects.create_user(email=f"{local}@{DOMAIN}", password=password, display_name=name, organization=org)
            for r in {Role.EMPLOYEE, *roles}:
                RoleAssignment.objects.create(user=user, role=r)
            emps[local] = Employee.objects.create(
                organization=org, user=user, employee_code=issue_employee_code(org), display_name=name,
                official_email=user.email, department=depts[dept], designation=title,
                reporting_manager=emps[mgr] if mgr else None, start_date=date.fromisoformat(start), status=status,
            )
            admin_user = admin_user or user
            SalaryVersion.objects.create(
                employee=emps[local], effective_from=date.fromisoformat(start), monthly_gross=Decimal(gross),
                components=split(gross), created_by=admin_user,
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(emps)} synthetic employees in {org}. Sign in as <name>@{DOMAIN} with SEED_DEMO_PASSWORD."))
