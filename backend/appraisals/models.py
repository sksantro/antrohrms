"""Joining-anniversary appraisal (BRD §13): self review, manager evaluation with a mandatory discussion, Super Admin outcome."""
import uuid

from django.conf import settings
from django.db import models


class Review(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN"  # self review open
        SELF_SUBMITTED = "SELF_SUBMITTED"  # with the manager
        MANAGER_COMPLETED = "MANAGER_COMPLETED"  # EVALUATION_COMPLETED: with the Super Admin
        APPROVED = "APPROVED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="reviews")
    manager = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.PROTECT, related_name="team_reviews")
    cycle_year = models.PositiveSmallIntegerField()
    due_date = models.DateField()  # the joining anniversary
    opened_on = models.DateField()
    template_code = models.CharField(max_length=20)
    questions = models.JSONField()  # frozen copy for this cycle: [{key, group, text, rated, weight}]
    status = models.CharField(max_length=18, choices=Status.choices, default=Status.OPEN)
    self_answers = models.JSONField(default=list)  # [{key, rating, text}]
    self_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    self_submitted_at = models.DateTimeField(null=True, blank=True)
    attachments = models.ManyToManyField("common.StoredFile", blank=True, related_name="+")
    manager_answers = models.JSONField(default=list)
    manager_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    manager_comments = models.TextField(blank=True)
    recommendation = models.CharField(max_length=10, default="NONE")  # NONE | INCREMENT | PROMOTION | BOTH (never an amount)
    recommendation_note = models.CharField(max_length=500, blank=True)
    meeting_date = models.DateField(null=True, blank=True)
    strengths = models.TextField(blank=True)
    development_plan = models.TextField(blank=True)
    disagreements = models.TextField(blank=True)
    employee_comments = models.TextField(blank=True)
    employee_ack_at = models.DateTimeField(null=True, blank=True)
    manager_completed_at = models.DateTimeField(null=True, blank=True)
    final_rating = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    new_designation = models.CharField(max_length=120, blank=True)
    effective_date = models.DateField(null=True, blank=True)
    promotion_applied = models.BooleanField(default=False)
    salary_version = models.ForeignKey("payroll.SalaryVersion", null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    admin_note = models.CharField(max_length=500, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-due_date"]
        constraints = [models.UniqueConstraint(fields=["employee", "cycle_year"], name="one_review_per_cycle")]
