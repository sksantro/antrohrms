"""Holiday calendar with optional holidays (BRD §5) and CL/SL/EL leave with an immutable ledger (BRD §6)."""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class HolidayCalendar(models.Model):
    """One revision of a year's calendar. HR drafts, Super Admin publishes; a published revision is never edited."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        SUBMITTED = "SUBMITTED"
        PUBLISHED = "PUBLISHED"
        SUPERSEDED = "SUPERSEDED"
        REJECTED = "REJECTED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    year = models.PositiveSmallIntegerField()
    revision = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    note = models.CharField(max_length=500, blank=True)
    decision_note = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "-revision"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "year", "revision"], name="uniq_calendar_revision"),
            models.UniqueConstraint(fields=["organization", "year"], condition=Q(status__in=["DRAFT", "SUBMITTED"]), name="one_open_calendar_draft"),
            models.UniqueConstraint(fields=["organization", "year"], condition=Q(status="PUBLISHED"), name="one_published_calendar"),
        ]


class Holiday(models.Model):
    class Kind(models.TextChoices):
        FIXED = "FIXED"
        OPTIONAL = "OPTIONAL"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    calendar = models.ForeignKey(HolidayCalendar, on_delete=models.CASCADE, related_name="holidays")
    date = models.DateField()
    name = models.CharField(max_length=80)
    kind = models.CharField(max_length=8, choices=Kind.choices)

    class Meta:
        ordering = ["date"]
        constraints = [models.UniqueConstraint(fields=["calendar", "date"], name="uniq_holiday_date_per_calendar")]


class OptionalHolidayChoice(models.Model):
    """An employee's pick. Stored by date so it survives calendar revisions; auto-approved (BRD §5.3)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="holiday_choices")
    date = models.DateField()
    name = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]
        constraints = [models.UniqueConstraint(fields=["employee", "date"], name="uniq_optional_choice")]


class Category(models.TextChoices):
    CL = "CL", "Casual Leave"
    SL = "SL", "Sick Leave"
    EL = "EL", "Earned Leave"


class LeaveRequest(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"
        NEEDS_CHANGES = "NEEDS_CHANGES"
        CANCELLED = "CANCELLED"

    ACTIVE = ("SUBMITTED", "APPROVED", "NEEDS_CHANGES")  # these block overlapping requests
    HOLDING = ("SUBMITTED", "NEEDS_CHANGES")  # these hold balance provisionally

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="leave_requests")
    category = models.CharField(max_length=2, choices=Category.choices)
    start = models.DateField()
    end = models.DateField()
    half_day = models.BooleanField(default=False)
    days = models.DecimalField(max_digits=4, decimal_places=1)
    reason = models.CharField(max_length=500)
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.SUBMITTED)
    decision_note = models.CharField(max_length=500, blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start", "-created_at"]
        constraints = [models.CheckConstraint(condition=Q(end__gte=models.F("start")), name="leave_end_after_start")]


class LeaveLedger(models.Model):
    """Append-only. Balance = sum(days). Grants are positive; approved leave is negative; a cancel reverses it."""

    class Source(models.TextChoices):
        GRANT = "GRANT"
        LEAVE = "LEAVE"
        CANCEL = "CANCEL"
        ADJUSTMENT = "ADJUSTMENT"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="leave_ledger")
    category = models.CharField(max_length=2, choices=Category.choices)
    year = models.PositiveSmallIntegerField()
    days = models.DecimalField(max_digits=5, decimal_places=1)
    source = models.CharField(max_length=10, choices=Source.choices)
    request = models.ForeignKey(LeaveRequest, null=True, blank=True, on_delete=models.PROTECT, related_name="ledger")
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "category", "year"], condition=Q(source="GRANT"), name="one_grant_per_year"),
            models.UniqueConstraint(fields=["request", "source"], condition=Q(request__isnull=False), name="one_ledger_row_per_request_action"),
        ]
