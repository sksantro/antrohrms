from django.db.models import Count
from django.utils import timezone

from leads.models import Lead, LeadActivity, LeadContact, LeadStatusChange, SalesRiskEvent

NOT_COUNTED_REASONS = {
    SalesRiskEvent.AlertType.DUPLICATE_ACTIVITY: 'Duplicate activity on the same lead today.',
    SalesRiskEvent.AlertType.SAME_REMARK_REPEATED: 'Remarks unchanged from the previous update.',
    SalesRiskEvent.AlertType.SAME_STATUS_NO_CHANGE: 'Status changed to the same value without meaningful update.',
}


def create_risk_event(
    *,
    employee,
    alert_type: str,
    message: str,
    severity: str = SalesRiskEvent.Severity.MEDIUM,
    lead=None,
    activity=None,
    dedupe_day: bool = True,
) -> SalesRiskEvent | None:
    today = timezone.localdate()
    if dedupe_day:
        existing = SalesRiskEvent.objects.filter(
            employee=employee,
            alert_type=alert_type,
            lead=lead,
            activity=activity,
            created_at__date=today,
            is_resolved=False,
        )
        if existing.exists():
            return None

    return SalesRiskEvent.objects.create(
        employee=employee,
        lead=lead,
        activity=activity,
        alert_type=alert_type,
        severity=severity,
        message=message,
    )


def record_duplicate_activity_event(user, lead, activity: LeadActivity | None = None):
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.DUPLICATE_ACTIVITY,
        message=f'Duplicate activity logged for {lead.company_name} and marked not countable for KPI.',
        severity=SalesRiskEvent.Severity.MEDIUM,
        lead=lead,
        activity=activity,
    )


def record_same_status_event(user, lead):
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.SAME_STATUS_NO_CHANGE,
        message=f'Same status update on {lead.company_name} marked not countable for KPI.',
        severity=SalesRiskEvent.Severity.MEDIUM,
        lead=lead,
    )


def record_same_remark_event(user, lead):
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.SAME_REMARK_REPEATED,
        message=f'Repeated remarks on {lead.company_name} marked not countable for KPI.',
        severity=SalesRiskEvent.Severity.LOW,
        lead=lead,
    )


def record_activity_edited_event(user, lead, activity: LeadActivity, changes: dict):
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.ACTIVITY_EDITED,
        message=f'Activity edited on {lead.company_name}: {", ".join(changes.keys())}.',
        severity=SalesRiskEvent.Severity.MEDIUM,
        lead=lead,
        activity=activity,
        dedupe_day=False,
    )


def record_activity_deleted_event(user, lead, activity: LeadActivity):
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.ACTIVITY_DELETED,
        message=f'Activity deleted on {lead.company_name}.',
        severity=SalesRiskEvent.Severity.HIGH,
        lead=lead,
        activity=activity,
        dedupe_day=False,
    )


def record_bulk_upload_duplicates_event(user, skipped_rows: int, file_name: str):
    if skipped_rows <= 0:
        return
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.BULK_UPLOAD_DUPLICATES,
        message=f'{skipped_rows} duplicate row(s) skipped during bulk upload of {file_name}.',
        severity=SalesRiskEvent.Severity.LOW,
        dedupe_day=False,
    )


def record_checkout_events(user, kpi_miss_reason: str, has_unmatched_kpi: bool):
    if has_unmatched_kpi:
        create_risk_event(
            employee=user,
            alert_type=SalesRiskEvent.AlertType.KPI_MISSED,
            message='Daily KPI targets were not fully matched at checkout.',
            severity=SalesRiskEvent.Severity.HIGH,
        )
    if kpi_miss_reason:
        create_risk_event(
            employee=user,
            alert_type=SalesRiskEvent.AlertType.CHECKOUT_REASON_SUBMITTED,
            message=f'Checkout KPI miss reason submitted: {kpi_miss_reason[:200]}',
            severity=SalesRiskEvent.Severity.MEDIUM,
        )


def check_low_lead_quality(user, lead: Lead):
    if lead.website and lead.industry not in {'', 'General'} and lead.country not in {'', 'Not specified'}:
        return
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.LOW_LEAD_QUALITY,
        message=f'Lead {lead.company_name} created with minimal company details.',
        severity=SalesRiskEvent.Severity.LOW,
        lead=lead,
    )


def check_leads_without_decision_makers(user):
    leads_without_contacts = (
        Lead.objects.filter(lead_owner=user)
        .annotate(contact_total=Count('contacts'))
        .filter(contact_total=0)
        .count()
    )
    if leads_without_contacts < 5:
        return
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.LEADS_WITHOUT_DECISION_MAKERS,
        message=f'{leads_without_contacts} owned leads have no decision maker contacts.',
        severity=SalesRiskEvent.Severity.MEDIUM,
    )


def check_repeated_remarks_pattern(user):
    from leads.services import normalize_text

    today = timezone.localdate()
    notes_counts: dict[str, int] = {}
    for activity in LeadActivity.objects.filter(created_by=user, created_at__date=today, is_deleted=False):
        key = normalize_text(activity.notes)
        if not key:
            continue
        notes_counts[key] = notes_counts.get(key, 0) + 1

    repeated = [count for count in notes_counts.values() if count >= 3]
    if not repeated:
        return
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.SAME_REMARK_REPEATED,
        message='Same remarks/outcome repeated across multiple activities today.',
        severity=SalesRiskEvent.Severity.MEDIUM,
    )


def check_overdue_followups(user):
    today = timezone.localdate()
    overdue_count = (
        Lead.objects.filter(lead_owner=user, next_follow_up_date__lt=today)
        .exclude(current_status__in=[Lead.CurrentStatus.CLOSED, Lead.CurrentStatus.LOST])
        .count()
    )
    if overdue_count <= 0:
        return
    create_risk_event(
        employee=user,
        alert_type=SalesRiskEvent.AlertType.OVERDUE_FOLLOWUP,
        message=f'{overdue_count} lead follow-up(s) are overdue.',
        severity=SalesRiskEvent.Severity.HIGH,
    )


def get_employee_risk_dashboard(user):
    from leads.kpi import get_daily_kpi_summary

    today = timezone.localdate()
    check_overdue_followups(user)
    check_leads_without_decision_makers(user)

    kpi_summary = get_daily_kpi_summary(user)
    kpi_missed = any(metric['status'] == 'Not Matched' for metric in kpi_summary['metrics'])

    overdue_followups = (
        Lead.objects.filter(lead_owner=user, next_follow_up_date__lt=today)
        .exclude(current_status__in=[Lead.CurrentStatus.CLOSED, Lead.CurrentStatus.LOST])
        .count()
    )

    not_counted_today = LeadActivity.objects.filter(
        created_by=user,
        created_at__date=today,
        is_countable_for_kpi=False,
        is_deleted=False,
    ).count() + LeadStatusChange.objects.filter(
        changed_by=user,
        changed_at__date=today,
        is_countable_for_kpi=False,
    ).count()

    recent_alerts = list(
        SalesRiskEvent.objects.filter(employee=user, is_resolved=False)
        .select_related('lead', 'activity')
        .order_by('-created_at')[:8]
        .values(
            'id',
            'alert_type',
            'severity',
            'message',
            'created_at',
            'lead_id',
            'activity_id',
            'is_resolved',
        )
    )

    return {
        'date': today.isoformat(),
        'overdue_followups': overdue_followups,
        'kpi_missed_today': kpi_missed,
        'not_counted_today': not_counted_today,
        'recent_alerts': recent_alerts,
    }
