"""Shared synthetic fixtures for API tests."""
from datetime import date
from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from accounts.models import Role, RoleAssignment, User
from common.models import Organization
from employees.models import Department, Employee
from payroll.models import SalaryVersion

PASSWORD = "Test-Passw0rd-xyz"


class Fixture(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(legal_name="Test Org Pvt Ltd", short_name="Test")
        cls.dept = Department.objects.create(organization=cls.org, name="Engineering")
        cls.admin = cls.make("admin", [Role.SUPER_ADMIN])
        cls.hr = cls.make("hr", [Role.HR_OPERATIONS])
        cls.mgr = cls.make("mgr", [Role.REPORTING_MANAGER])
        cls.emp = cls.make("emp", [], manager=cls.mgr)
        cls.other = cls.make("other", [])
        SalaryVersion.objects.create(
            employee=cls.emp.employee, effective_from=date(2026, 1, 1), monthly_gross=Decimal("30000"),
            components=[{"code": "BASIC", "name": "Basic", "type": "EARNING", "amount": "30000.00"}], created_by=cls.admin,
        )

    @classmethod
    def make(cls, name: str, roles: list[str], manager: User | None = None) -> User:
        u = User.objects.create_user(email=f"{name}@test.example", password=PASSWORD, display_name=name.title(), organization=cls.org)
        for r in {Role.EMPLOYEE, *roles}:
            RoleAssignment.objects.create(user=u, role=r)
        Employee.objects.create(
            organization=cls.org, user=u, employee_code=f"T-{name}", display_name=u.display_name, official_email=u.email,
            department=cls.dept, designation="Engineer", start_date=date(2026, 1, 31),
            reporting_manager=manager.employee if manager else None,
        )
        return u

    def as_user(self, user: User) -> APIClient:
        c = APIClient()
        c.force_authenticate(user=user)
        return c
