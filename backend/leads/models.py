from django.conf import settings
from django.db import models


class Lead(models.Model):
    class ServiceFit(models.TextChoices):
        ANTRO_WORKFORCE = 'ANTRO_WORKFORCE', 'Antro Workforce Services'
        WODENA_TECHNOLOGY = 'WODENA_TECHNOLOGY', 'Wodena Technology Services'
        IGOLO_INTERIOR = 'IGOLO_INTERIOR', 'Igolo Interior Services'
        TECHNOLOGY_SOLUTIONS = 'TECHNOLOGY_SOLUTIONS', 'Technology Solutions'

    class CurrentStatus(models.TextChoices):
        NEW = 'NEW', 'New'
        CONTACTED = 'CONTACTED', 'Contacted'
        INTERESTED = 'INTERESTED', 'Interested'
        FOLLOW_UP_REQUIRED = 'FOLLOW_UP_REQUIRED', 'Follow-up Required'
        MEETING_BOOKED = 'MEETING_BOOKED', 'Meeting Booked'
        PROPOSAL_SENT = 'PROPOSAL_SENT', 'Proposal Sent'
        NOT_INTERESTED = 'NOT_INTERESTED', 'Not Interested'
        CLOSED = 'CLOSED', 'Closed'
        LOST = 'LOST', 'Lost'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    company_name = models.CharField(max_length=255)
    website = models.URLField(blank=True)
    country = models.CharField(max_length=100)
    industry = models.CharField(max_length=150)
    company_size = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=100, blank=True)
    service_fit = models.CharField(max_length=40, choices=ServiceFit.choices)
    current_status = models.CharField(
        max_length=30,
        choices=CurrentStatus.choices,
        default=CurrentStatus.NEW,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    remarks = models.TextField(blank=True)
    next_follow_up_date = models.DateField(null=True, blank=True)
    last_activity_date = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_leads',
    )
    lead_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='owned_leads',
    )
    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='last_updated_leads',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return self.company_name


class LeadContact(models.Model):
    """Decision-maker contact linked to a company lead."""

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='contacts',
    )
    full_name = models.CharField(max_length=150)
    designation = models.CharField(max_length=150)
    department = models.CharField(max_length=100, blank=True)
    linkedin_profile_url = models.URLField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    location = models.CharField(max_length=150, blank=True)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('full_name',)

    def __str__(self):
        return f'{self.full_name} ({self.lead.company_name})'


class LeadActivity(models.Model):
    class ActivityType(models.TextChoices):
        LINKEDIN_MESSAGE_SENT = 'LINKEDIN_MESSAGE_SENT', 'LinkedIn Message Sent'
        COLD_CALL_MADE = 'COLD_CALL_MADE', 'Cold Call Made'
        FOLLOW_UP_DONE = 'FOLLOW_UP_DONE', 'Follow-up Done'
        MEETING_DEMO_BOOKED = 'MEETING_DEMO_BOOKED', 'Meeting / Demo Booked'
        EMAIL_SENT = 'EMAIL_SENT', 'Email Sent'
        PROPOSAL_SENT = 'PROPOSAL_SENT', 'Proposal Sent'
        GENERAL_NOTE = 'GENERAL_NOTE', 'General Note'

    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        DONE = 'DONE', 'Done'
        CLOSED = 'CLOSED', 'Closed'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='activities',
    )
    activity_type = models.CharField(max_length=40, choices=ActivityType.choices)
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='assigned_lead_activities',
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    completion_notes = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_countable_for_kpi = models.BooleanField(default=True)
    not_counted_reason = models.TextField(blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_lead_activities',
    )
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='edited_lead_activities',
    )
    edited_at = models.DateTimeField(null=True, blank=True)
    edit_history = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='lead_activities',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    @property
    def is_overdue(self):
        if not self.due_date or self.status in {self.Status.DONE, self.Status.CLOSED}:
            return False
        from django.utils import timezone
        return self.due_date < timezone.localdate()

    def __str__(self):
        return f'{self.get_activity_type_display()} — {self.lead.company_name}'


class LeadStatusChange(models.Model):
    """Tracks when a lead status is updated (used for Interested Leads KPI)."""

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='status_changes',
    )
    previous_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30)
    remarks = models.TextField(blank=True)
    is_countable_for_kpi = models.BooleanField(default=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='lead_status_changes',
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-changed_at',)

    def __str__(self):
        return f'{self.lead.company_name}: {self.previous_status} → {self.new_status}'


class LeadBulkUploadSession(models.Model):
    """Temporary storage for an in-progress bulk lead upload wizard."""

    id = models.UUIDField(primary_key=True, editable=False)
    file_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lead_bulk_upload_sessions',
    )
    sheets_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.file_name} ({self.uploaded_by_id})'


class LeadImportHistory(models.Model):
    file_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='lead_import_histories',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    total_rows = models.PositiveIntegerField(default=0)
    imported_rows = models.PositiveIntegerField(default=0)
    skipped_rows = models.PositiveIntegerField(default=0)
    failed_rows = models.PositiveIntegerField(default=0)
    sheet_name = models.CharField(max_length=100, blank=True)
    column_mapping = models.JSONField(null=True, blank=True)
    error_details = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ('-uploaded_at',)
        verbose_name_plural = 'Lead import histories'

    def __str__(self):
        return f'{self.file_name} — {self.uploaded_at:%Y-%m-%d %H:%M}'


class SalesRiskEvent(models.Model):
    class AlertType(models.TextChoices):
        DUPLICATE_ACTIVITY = 'DUPLICATE_ACTIVITY', 'Duplicate Activity'
        SAME_REMARK_REPEATED = 'SAME_REMARK_REPEATED', 'Same Remark Repeated'
        SAME_STATUS_NO_CHANGE = 'SAME_STATUS_NO_CHANGE', 'Same Status No Change'
        LOW_LEAD_QUALITY = 'LOW_LEAD_QUALITY', 'Low Lead Quality'
        LEADS_WITHOUT_DECISION_MAKERS = 'LEADS_WITHOUT_DECISION_MAKERS', 'Leads Without Decision Makers'
        KPI_MISSED = 'KPI_MISSED', 'KPI Missed'
        CHECKOUT_REASON_SUBMITTED = 'CHECKOUT_REASON_SUBMITTED', 'Checkout Reason Submitted'
        OVERDUE_FOLLOWUP = 'OVERDUE_FOLLOWUP', 'Overdue Follow-up'
        BULK_UPLOAD_DUPLICATES = 'BULK_UPLOAD_DUPLICATES', 'Bulk Upload Duplicates'
        ACTIVITY_EDITED = 'ACTIVITY_EDITED', 'Activity Edited'
        ACTIVITY_DELETED = 'ACTIVITY_DELETED', 'Activity Deleted'

    class Severity(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sales_risk_events',
    )
    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_risk_events',
    )
    activity = models.ForeignKey(
        LeadActivity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_risk_events',
    )
    alert_type = models.CharField(max_length=40, choices=AlertType.choices)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_sales_risk_events',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.get_alert_type_display()} — {self.employee_id}'
