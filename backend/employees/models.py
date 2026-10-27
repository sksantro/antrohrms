import calendar
import uuid
from datetime import date

from django.conf import settings
from django.db import models


def add_months(d: date, months: int) -> date:
    """Calendar-month addition keeping month-end edge cases (31 Jan + 1 → 28/29 Feb) — BRD §3.3."""
    m = d.month - 1 + months
    y, m = d.year + m // 12, m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    name = models.CharField(max_length=80)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="uniq_department")]
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class EmployeeCodeSequence(models.Model):
    organization = models.OneToOneField("common.Organization", on_delete=models.PROTECT, primary_key=True)
    prefix = models.CharField(max_length=10, default="APT")
    next_value = models.PositiveIntegerField(default=1)


class Employee(models.Model):
    class EmploymentType(models.TextChoices):
        FULL_TIME = "FULL_TIME"
        INTERN = "INTERN"
        CONTRACT = "CONTRACT"

    class Status(models.TextChoices):
        PREBOARDING = "PREBOARDING"
        PROBATION = "PROBATION"
        ACTIVE_CONFIRMED = "ACTIVE_CONFIRMED"
        NOTICE_PERIOD = "NOTICE_PERIOD"
        EXITED = "EXITED"
        INACTIVE = "INACTIVE"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="employee")
    employee_code = models.CharField(max_length=20, unique=True, null=True, blank=True)  # immutable once issued
    display_name = models.CharField(max_length=120)
    official_email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="employees")
    designation = models.CharField(max_length=120)
    reporting_manager = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="direct_reports")
    employment_type = models.CharField(max_length=12, choices=EmploymentType.choices, default=EmploymentType.FULL_TIME)
    start_date = models.DateField()
    probation_months = models.PositiveSmallIntegerField(default=3)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROBATION)
    address = models.TextField(blank=True)
    emergency_contact = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_name"]

    def __str__(self) -> str:
        return f"{self.display_name} ({self.employee_code or 'no code'})"

    @property
    def probation_end(self) -> date:
        return add_months(self.start_date, self.probation_months)
