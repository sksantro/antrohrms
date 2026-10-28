"""Onsite attendance (BRD §4). The event ledger is the source of truth; AttendanceDay holds a derived summary."""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class Proof(models.TextChoices):
    VERIFIED = "VERIFIED"            # distance + accuracy within the office radius
    INCONCLUSIVE = "INCONCLUSIVE"    # accuracy too poor, location unavailable, or office not configured
    FAILED = "FAILED"                # clearly outside the office radius
    ADMIN_OVERRIDE = "ADMIN_OVERRIDE"  # Super Admin accepted after manual verification
    REMOTE = "REMOTE"                # work-from-home day: no office geofence; verified by plan, presence checks and summary


class Mode(models.TextChoices):
    WFO = "WFO", "Work from office"
    WFH = "WFH", "Work from home"


class AttendanceDay(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN"
        CLOSED = "CLOSED"

    class Review(models.TextChoices):
        NONE = "NONE"
        PENDING = "PENDING_REVIEW"   # shortfall reason or proof needs Super Admin review
        REVIEWED = "REVIEWED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="attendance_days")
    work_date = models.DateField()  # Asia/Kolkata date of check-in
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    check_in_at = models.DateTimeField()
    check_out_at = models.DateTimeField(null=True, blank=True)
    proof = models.CharField(max_length=16, choices=Proof.choices)
    proof_note = models.CharField(max_length=200, blank=True)
    mode = models.CharField(max_length=3, choices=Mode.choices, default=Mode.WFO)
    plan = models.TextField(blank=True)      # WFH: what the person will work on (given at check-in)
    summary = models.TextField(blank=True)   # WFH: what got done, with optional links (given at check-out)
    wfh_request = models.ForeignKey("WfhRequest", null=True, blank=True, on_delete=models.PROTECT, related_name="days")
    shortfall_reason = models.TextField(blank=True)
    review_status = models.CharField(max_length=16, choices=Review.choices, default=Review.NONE)
    review_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    # Derived from events at close / correction; live values are computed on read.
    work_seconds = models.PositiveIntegerField(default=0)
    presence_seconds = models.PositiveIntegerField(default=0)
    tea_seconds = models.PositiveIntegerField(default=0)
    lunch_seconds = models.PositiveIntegerField(default=0)
    tea_count = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-work_date"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "work_date"], name="uniq_attendance_day"),
            models.UniqueConstraint(fields=["employee"], condition=Q(status="OPEN"), name="one_open_attendance_day"),
        ]


class AttendanceEvent(models.Model):
    """Append-only. Timestamps are always server time (BRD §4.1)."""

    class Type(models.TextChoices):
        CHECK_IN = "CHECK_IN"
        START_TEA = "START_TEA"
        END_TEA = "END_TEA"
        START_LUNCH = "START_LUNCH"
        END_LUNCH = "END_LUNCH"
        CHECK_OUT = "CHECK_OUT"
        LOCATION_VERIFIED = "LOCATION_VERIFIED"
        VERIFICATION_FAILED = "VERIFICATION_FAILED"
        CORRECTION_REQUESTED = "CORRECTION_REQUESTED"
        CORRECTION_APPROVED = "CORRECTION_APPROVED"
        PRESENCE_CONFIRMED = "PRESENCE_CONFIRMED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(AttendanceDay, on_delete=models.PROTECT, related_name="events")
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="+")
    type = models.CharField(max_length=24, choices=Type.choices)
    at = models.DateTimeField()
    recorded_at = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    idempotency_key = models.CharField(max_length=80, null=True, blank=True)
    # Location evidence (only on check-in / re-verification). Restricted to Super Admin views.
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    accuracy_m = models.PositiveIntegerField(null=True, blank=True)
    distance_m = models.PositiveIntegerField(null=True, blank=True)
    proof = models.CharField(max_length=16, choices=Proof.choices, blank=True)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["at", "recorded_at"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "idempotency_key"], condition=Q(idempotency_key__isnull=False), name="uniq_attendance_idempotency"),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("Attendance events are append-only")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Attendance events are append-only")


class AttendanceCorrection(models.Model):
    """Employee asks to add a missed punch; only Super Admin decides (BRD §4.2)."""

    class Status(models.TextChoices):
        PENDING = "PENDING"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"

    EVENT_CHOICES = [("CHECK_OUT", "Missed check-out"), ("END_TEA", "Missed tea resume"), ("END_LUNCH", "Missed lunch resume")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(AttendanceDay, on_delete=models.PROTECT, related_name="corrections")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    event_type = models.CharField(max_length=16, choices=EVENT_CHOICES)
    proposed_at = models.DateTimeField()
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class WfhRequest(models.Model):
    """Weekday work from home. Approved in advance by the Super Admin; an emergency same-day request starts
    work immediately and is approved afterwards. Owner-approved change to BRD §7.1 (weekday WFH), 28 Oct 2026."""

    class Status(models.TextChoices):
        PENDING = "PENDING"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"
        CANCELLED = "CANCELLED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="wfh_requests")
    date = models.DateField()
    reason = models.TextField()
    emergency = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date"], condition=Q(status__in=["PENDING", "APPROVED"]), name="one_active_wfh_request_per_day"),
        ]


class PresenceCheck(models.Model):
    """A random "Are you there?" prompt on a work-from-home day. Missing one is noted for review, never deducted."""

    class Status(models.TextChoices):
        PENDING = "PENDING"
        ANSWERED = "ANSWERED"
        MISSED = "MISSED"
        CANCELLED = "CANCELLED"   # day ended before it was due, or it fell due right at check-out

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(AttendanceDay, on_delete=models.PROTECT, related_name="presence_checks")
    due_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ["due_at"]
