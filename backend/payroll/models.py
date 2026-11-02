import uuid

from django.conf import settings
from django.db import models


class SalaryVersion(models.Model):
    """Effective-dated fixed monthly salary. New versions are added; history is never edited (BRD §8.1).

    Confidential: only Super Admin endpoints may serialize this model.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="salary_versions")
    effective_from = models.DateField()
    monthly_gross = models.DecimalField(max_digits=12, decimal_places=2)
    components = models.JSONField(default=list)  # [{code, name, type, amount}]
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-effective_from"]
        constraints = [models.UniqueConstraint(fields=["employee", "effective_from"], name="uniq_salary_effective_date")]


class PayrollRun(models.Model):
    """One month. DRAFT can be recalculated; APPROVED is locked and its payslips are immutable (BRD §8.4)."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        APPROVED = "APPROVED"
        PAID = "PAID"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    warnings = models.JSONField(default=list)
    calculated_at = models.DateTimeField()
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "-month"]
        constraints = [models.UniqueConstraint(fields=["organization", "year", "month"], name="one_payroll_run_per_month")]


class Payslip(models.Model):
    """Snapshot of everything printed on the slip, frozen at calculation; `digest` is a SHA-256 of that snapshot."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(PayrollRun, on_delete=models.PROTECT, related_name="payslips")
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="payslips")
    unpaid_days = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    adjustments = models.JSONField(default=list)  # [{name, type: EARNING|DEDUCTION, amount, note}]
    data = models.JSONField(default=dict)
    gross = models.DecimalField(max_digits=12, decimal_places=2)
    deductions = models.DecimalField(max_digits=12, decimal_places=2)
    net = models.DecimalField(max_digits=12, decimal_places=2)
    flags = models.JSONField(default=list)
    digest = models.CharField(max_length=64)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__display_name"]
        constraints = [models.UniqueConstraint(fields=["run", "employee"], name="one_payslip_per_employee_run")]
