"""Candidates, interview rounds, scorecards, selection and offers (BRD §9). Salary on an offer is Super Admin only."""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class Candidate(models.Model):
    class Stage(models.TextChoices):
        NEW = "NEW"
        INTERVIEWING = "INTERVIEWING"
        SELECTION_PENDING = "SELECTION_PENDING"
        SELECTED = "SELECTED"
        REJECTED = "REJECTED"
        OFFERED = "OFFERED"
        OFFER_ACCEPTED = "OFFER_ACCEPTED"
        OFFER_DECLINED = "OFFER_DECLINED"
        WITHDRAWN = "WITHDRAWN"
        JOINED = "JOINED"

    CLOSED = ("REJECTED", "OFFER_DECLINED", "WITHDRAWN", "JOINED")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    role_applied = models.CharField(max_length=120)
    department = models.ForeignKey("employees.Department", null=True, blank=True, on_delete=models.PROTECT)
    template_code = models.CharField(max_length=20, default="GENERAL")
    source = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    stage = models.CharField(max_length=18, choices=Stage.choices, default=Stage.NEW)
    resume = models.ForeignKey("common.StoredFile", null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    decision_note = models.CharField(max_length=500, blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(Lower("email"), "organization", name="uniq_candidate_email")]


class ScorecardTemplate(models.Model):
    """Versioned questions per role family. A round keeps the version it was scheduled with, so answers never drift."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    code = models.CharField(max_length=20)
    version = models.PositiveSmallIntegerField(default=1)
    name = models.CharField(max_length=80)
    questions = models.JSONField()  # [{key, text, weight, evidence_required}]
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code", "-version"]
        constraints = [models.UniqueConstraint(fields=["organization", "code", "version"], name="uniq_template_version")]


class InterviewRound(models.Model):
    class Kind(models.TextChoices):
        TECHNICAL = "TECHNICAL", "Technical"
        MANAGER = "MANAGER", "Manager"
        CULTURE = "CULTURE", "Culture fit"
        HR = "HR", "HR"

    class Mode(models.TextChoices):
        ONLINE = "ONLINE"
        ONSITE = "ONSITE"

    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    candidate = models.ForeignKey(Candidate, on_delete=models.PROTECT, related_name="rounds")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    scheduled_at = models.DateTimeField()
    duration_min = models.PositiveSmallIntegerField(default=45)
    mode = models.CharField(max_length=6, choices=Mode.choices)
    meeting_url = models.URLField(blank=True)
    location = models.CharField(max_length=300, blank=True)
    interviewers = models.ManyToManyField("employees.Employee", related_name="interview_rounds")
    template = models.ForeignKey(ScorecardTemplate, on_delete=models.PROTECT)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SCHEDULED)
    reschedules = models.PositiveSmallIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_at"]


class Feedback(models.Model):
    """One interviewer's scorecard for one round. Locked on submit; an amendment is a new revision."""

    class Overall(models.TextChoices):
        RECOMMENDED = "RECOMMENDED"
        NOT_RECOMMENDED = "NOT_RECOMMENDED"
        NEXT_ROUND = "NEXT_ROUND"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    round = models.ForeignKey(InterviewRound, on_delete=models.PROTECT, related_name="feedback")
    interviewer = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="+")
    revision = models.PositiveSmallIntegerField(default=1)
    answers = models.JSONField(default=list)  # [{key, rating 1-5 | null, evaluation, remark}]
    overall = models.CharField(max_length=16, choices=Overall.choices, blank=True)
    comments = models.TextField(blank=True)
    score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    amend_reason = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["round", "interviewer", "-revision"]
        constraints = [models.UniqueConstraint(fields=["round", "interviewer", "revision"], name="uniq_feedback_revision")]


class Offer(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        PENDING_ADMIN = "PENDING_ADMIN"
        SENT = "SENT"  # approved and emailed in one step; HR never clicks Send (BRD 9.3)
        ACCEPTED = "ACCEPTED"
        DECLINED = "DECLINED"
        EXPIRED = "EXPIRED"
        WITHDRAWN = "WITHDRAWN"

    OPEN = ("DRAFT", "PENDING_ADMIN", "SENT", "ACCEPTED")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    candidate = models.ForeignKey(Candidate, on_delete=models.PROTECT, related_name="offers")
    designation = models.CharField(max_length=120)
    department = models.ForeignKey("employees.Department", on_delete=models.PROTECT)
    employment_type = models.CharField(max_length=12, default="FULL_TIME")
    joining_date = models.DateField()
    reporting_manager = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    work_location = models.CharField(max_length=200)
    terms = models.TextField(blank=True)  # non-financial terms written by HR
    monthly_gross = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # Super Admin only
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.DRAFT)
    admin_note = models.CharField(max_length=500, blank=True)
    letter = models.TextField(blank=True)  # approved snapshot, salary included
    digest = models.CharField(max_length=64, blank=True)
    token_hash = models.CharField(max_length=64, blank=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    approved_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    signed_name = models.CharField(max_length=120, blank=True)
    response_ip = models.CharField(max_length=50, blank=True)  # network prefix only (minimised)
    decline_reason = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["candidate"], condition=Q(status__in=["DRAFT", "PENDING_ADMIN", "SENT", "ACCEPTED"]), name="one_open_offer")]
