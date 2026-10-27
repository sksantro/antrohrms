import uuid

from django.conf import settings
from django.db import models


class Organization(models.Model):
    """Single organization today; organization_id on records keeps future isolation possible (BRD §0.4)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=60)
    timezone = models.CharField(max_length=40, default="Asia/Kolkata")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.short_name


class OfficeSite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="sites")
    name = models.CharField(max_length=120)
    address = models.TextField(blank=True)
    # Null until the Super Admin enters real coordinates (REQUIRES_ADMIN_CONFIGURATION).
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    radius_m = models.PositiveIntegerField(default=50)
    is_active = models.BooleanField(default=True)


class PolicyVersion(models.Model):
    """Effective-dated, append-only policy values. A change creates a new row."""

    class Status(models.TextChoices):
        APPROVED = "APPROVED"
        REQUIRES_ADMIN_CONFIGURATION = "REQUIRES_ADMIN_CONFIGURATION"
        REQUIRES_LEGAL_REVIEW = "REQUIRES_LEGAL_REVIEW"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT)
    key = models.CharField(max_length=80)
    value = models.JSONField()
    status = models.CharField(max_length=40, choices=Status.choices, default=Status.APPROVED)
    effective_from = models.DateField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "key", "effective_from"], name="uniq_policy_key_effective")]
        ordering = ["key", "-effective_from"]


class AuditEvent(models.Model):
    """Write-once audit log (BRD §19). Never updated or deleted by the application."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, null=True, on_delete=models.PROTECT)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+")
    action = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=64, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)
    ip_prefix = models.CharField(max_length=45, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("Audit events are append-only")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Audit events are append-only")


class NotificationOutbox(models.Model):
    """Transactional outbox: rows are written in the business transaction and delivered after commit."""

    class Status(models.TextChoices):
        PENDING = "PENDING"
        SENT = "SENT"
        FAILED = "FAILED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, null=True, on_delete=models.PROTECT)
    template_key = models.CharField(max_length=80)
    recipient = models.EmailField()
    subject = models.CharField(max_length=200)
    body = models.TextField()
    business_ref = models.CharField(max_length=120, blank=True)
    dedupe_key = models.CharField(max_length=160, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
