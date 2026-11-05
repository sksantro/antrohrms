"""Company assets (BRD §12), resignation (§11.1), exit checklist and full & final settlement (§11.2)."""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class Asset(models.Model):
    class Category(models.TextChoices):
        LAPTOP = "LAPTOP", "Laptop"
        DESKTOP = "DESKTOP", "Desktop"
        MONITOR = "MONITOR", "Monitor"
        PHONE = "PHONE", "Phone"
        ACCESSORY = "ACCESSORY", "Accessory"
        ID_CARD = "ID_CARD", "ID / access card"
        PERSONAL_DEVICE = "PERSONAL_DEVICE", "Personal device (BYOD)"
        OTHER = "OTHER", "Other"

    class State(models.TextChoices):
        AVAILABLE = "AVAILABLE"
        ASSIGNED = "ASSIGNED"
        RETURN_PENDING = "RETURN_PENDING"
        RETURNED = "RETURNED"  # back, but damaged / missing / disputed: Super Admin decides
        WRITTEN_OFF = "WRITTEN_OFF"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    category = models.CharField(max_length=16, choices=Category.choices)
    make_model = models.CharField(max_length=120)
    tag = models.CharField(max_length=40)
    serial = models.CharField(max_length=80, blank=True)
    purchase_ref = models.CharField(max_length=80, blank=True)
    cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # Super Admin only
    location = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=16, choices=State.choices, default=State.AVAILABLE)
    owner = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.PROTECT, related_name="personal_devices")  # BYOD only
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["tag"]
        constraints = [models.UniqueConstraint(Lower("tag"), "organization", name="uniq_asset_tag")]


class Allocation(models.Model):
    """One hand-over of one asset to one person, and its return. Acknowledgements are typed confirmations, never edited."""

    class Condition(models.TextChoices):
        GOOD = "GOOD"
        DAMAGED = "DAMAGED"
        MISSING = "MISSING"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="allocations")
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="allocations")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    assigned_at = models.DateTimeField(auto_now_add=True)
    assign_note = models.CharField(max_length=300, blank=True)
    ack_at = models.DateTimeField(null=True, blank=True)
    ack_note = models.CharField(max_length=300, blank=True)
    return_started_at = models.DateTimeField(null=True, blank=True)
    condition = models.CharField(max_length=8, choices=Condition.choices, blank=True)
    return_note = models.CharField(max_length=300, blank=True)
    hr_ack_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    hr_ack_at = models.DateTimeField(null=True, blank=True)
    emp_ack_at = models.DateTimeField(null=True, blank=True)
    emp_agrees = models.BooleanField(null=True)
    emp_note = models.CharField(max_length=300, blank=True)
    disputed = models.BooleanField(default=False)
    admin_decision = models.CharField(max_length=16, blank=True)  # ACCEPT | WRITE_OFF | RECOVERY_REVIEW
    admin_note = models.CharField(max_length=300, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-assigned_at"]
        constraints = [models.UniqueConstraint(fields=["asset"], condition=Q(closed_at__isnull=True), name="one_open_allocation_per_asset")]

    @property
    def open(self) -> bool:
        return self.closed_at is None


class Resignation(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED"
        DISCUSSION_REQUESTED = "DISCUSSION_REQUESTED"
        NOTICE_REVISION_REQUESTED = "NOTICE_REVISION_REQUESTED"
        ACCEPTED = "ACCEPTED"
        WITHDRAWN = "WITHDRAWN"

    OPEN = ("SUBMITTED", "DISCUSSION_REQUESTED", "NOTICE_REVISION_REQUESTED")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="resignations")
    reason = models.TextField()
    submitted_on = models.DateField()
    proposed_last_day = models.DateField()
    notice_days = models.PositiveSmallIntegerField()
    letter = models.TextField()  # the version on record (immutable per revision)
    revision = models.PositiveSmallIntegerField(default=1)
    history = models.JSONField(default=list)  # earlier revisions [{revision, letter, proposed_last_day, at}]
    own_letter = models.ForeignKey("common.StoredFile", null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    status = models.CharField(max_length=26, choices=Status.choices, default=Status.SUBMITTED)
    admin_note = models.CharField(max_length=500, blank=True)
    accepted_last_day = models.DateField(null=True, blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["employee"], condition=Q(status__in=["SUBMITTED", "DISCUSSION_REQUESTED", "NOTICE_REVISION_REQUESTED", "ACCEPTED"]), name="one_active_resignation")]


class ExitCase(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS"
        COMPLETED = "COMPLETED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.OneToOneField("employees.Employee", on_delete=models.PROTECT, related_name="exit_case")
    resignation = models.OneToOneField(Resignation, on_delete=models.PROTECT, related_name="exit_case")
    last_working_day = models.DateField()
    checklist = models.JSONField(default=list)  # [{key, label, done, by, at}] (assets are checked live)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Settlement(models.Model):
    """Full & final. Drafted from the salary on record; only the Super Admin sees amounts, edits lines and approves."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        APPROVED = "APPROVED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exit_case = models.OneToOneField(ExitCase, on_delete=models.PROTECT, related_name="settlement")
    lines = models.JSONField(default=list)  # [{code, name, type EARNING|DEDUCTION, amount, note}]
    info = models.JSONField(default=dict)  # salary snapshot, paid days, leave balance, warnings
    net = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    digest = models.CharField(max_length=64, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    approved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
