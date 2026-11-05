"""Preboarding documents (magic link + OTP), Mark Joined, official letters and probation (BRD §3.3, §10)."""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class DocumentRequest(models.Model):
    """One portal invitation for an accepted candidate. The link is single-use: it unlocks an OTP, the OTP opens a short session."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    candidate = models.OneToOneField("recruitment.Candidate", on_delete=models.PROTECT, related_name="document_request")
    categories = models.JSONField(default=list)
    open = models.BooleanField(default=True)
    token_hash = models.CharField(max_length=64, db_index=True)
    link_expires_at = models.DateTimeField()
    link_used_at = models.DateTimeField(null=True, blank=True)
    otp_hash = models.CharField(max_length=64, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    otp_attempts = models.PositiveSmallIntegerField(default=0)
    otp_sent = models.JSONField(default=list)  # ISO times of recent sends, for the hourly limit
    session_hash = models.CharField(max_length=64, blank=True, db_index=True)
    session_expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class CandidateDocument(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "UPLOADED"
        RECEIVED = "RECEIVED"
        NEEDS_REUPLOAD = "NEEDS_REUPLOAD"
        VERIFIED = "VERIFIED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    candidate = models.ForeignKey("recruitment.Candidate", on_delete=models.PROTECT, related_name="documents")
    employee = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.PROTECT, related_name="joining_documents")
    category = models.CharField(max_length=20)
    file = models.ForeignKey("common.StoredFile", on_delete=models.PROTECT, related_name="+")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPLOADED)
    superseded = models.BooleanField(default=False)
    hr_note = models.CharField(max_length=300, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "-created_at"]
        constraints = [models.UniqueConstraint(fields=["candidate", "category"], condition=Q(superseded=False), name="one_current_document_per_category")]


class Onboarding(models.Model):
    """HR's checklist for one hire, from offer acceptance to joining."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    candidate = models.OneToOneField("recruitment.Candidate", on_delete=models.PROTECT, related_name="onboarding")
    employee = models.OneToOneField("employees.Employee", null=True, blank=True, on_delete=models.PROTECT, related_name="onboarding")
    checklist = models.JSONField(default=list)  # [{key, label, done, by, at}]
    joined_at = models.DateTimeField(null=True, blank=True)
    joined_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)


class LetterTemplate(models.Model):
    """Versioned letter text with {{placeholders}} from an allow-list. Editing creates a new version; letters keep the version they used."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    kind = models.CharField(max_length=24)
    version = models.PositiveSmallIntegerField(default=1)
    title = models.CharField(max_length=120)
    body = models.TextField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["kind", "-version"]
        constraints = [models.UniqueConstraint(fields=["organization", "kind", "version"], name="uniq_letter_template_version")]


class Letter(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        PENDING_ADMIN = "PENDING_ADMIN"
        RELEASED = "RELEASED"  # approved and sent in one step
        REJECTED = "REJECTED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="letters")
    kind = models.CharField(max_length=24)
    template = models.ForeignKey(LetterTemplate, on_delete=models.PROTECT)
    context = models.JSONField(default=dict)  # extra values for this letter (dates, note); salary values only from the server
    note = models.TextField(blank=True)  # HR's added paragraph
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.DRAFT)
    admin_note = models.CharField(max_length=500, blank=True)
    content = models.TextField(blank=True)  # frozen at release
    digest = models.CharField(max_length=64, blank=True)
    source = models.CharField(max_length=60, blank=True)  # e.g. "probation:<id>", "exit:<id>"
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    released_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class ProbationReview(models.Model):
    class Status(models.TextChoices):
        PENDING_ADMIN = "PENDING_ADMIN"
        CONFIRMED = "CONFIRMED"
        EXTENDED = "EXTENDED"
        CANCELLED = "CANCELLED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="probation_reviews")
    due_on = models.DateField()
    recommendation = models.CharField(max_length=8)  # CONFIRM | EXTEND
    extend_months = models.PositiveSmallIntegerField(default=0)
    hr_note = models.TextField()
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.PENDING_ADMIN)
    admin_note = models.CharField(max_length=500, blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["employee"], condition=Q(status="PENDING_ADMIN"), name="one_open_probation_review")]
