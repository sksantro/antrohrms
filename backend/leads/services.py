from django.db.models import Q
from django.utils import timezone

from leads.models import Lead, LeadActivity, LeadStatusChange

DUPLICATE_WARNING_MESSAGE = (
    'Same update already exists for this lead. This will not be counted as today\'s activity.'
)


def normalize_text(value: str) -> str:
    return (value or '').strip().lower()


def is_duplicate_activity(lead: Lead, user, activity_type: str, notes: str) -> bool:
    today = timezone.localdate()
    normalized_notes = normalize_text(notes)
    recent = LeadActivity.objects.filter(
        lead=lead,
        created_by=user,
        activity_type=activity_type,
        created_at__date=today,
        is_deleted=False,
    )
    return any(normalize_text(activity.notes) == normalized_notes for activity in recent)


def is_duplicate_status_change(lead: Lead, new_status: str, remarks: str) -> bool:
    normalized_remarks = normalize_text(remarks)
    if lead.current_status == new_status and normalize_text(lead.remarks) == normalized_remarks:
        return True

    today = timezone.localdate()
    recent = LeadStatusChange.objects.filter(
        lead=lead,
        new_status=new_status,
        changed_at__date=today,
    )
    return any(normalize_text(change.remarks) == normalized_remarks for change in recent)


def is_duplicate_remarks_update(lead: Lead, remarks: str) -> bool:
    return normalize_text(lead.remarks) == normalize_text(remarks)


def touch_lead_last_activity(lead: Lead, user=None):
    lead.last_activity_date = timezone.now()
    update_fields = ['last_activity_date', 'updated_at']
    if user is not None:
        lead.last_updated_by = user
        update_fields.append('last_updated_by')
    lead.save(update_fields=update_fields)


def filter_leads_queryset(queryset, params):
    status = params.get('status')
    service_fit = params.get('service_fit')
    country = params.get('country')
    industry = params.get('industry')
    priority = params.get('priority')
    lead_owner = params.get('lead_owner')
    created_by = params.get('created_by')
    date_from = params.get('date_from')
    date_to = params.get('date_to')
    next_follow_up_from = params.get('next_follow_up_from')
    next_follow_up_to = params.get('next_follow_up_to')
    last_activity_from = params.get('last_activity_from')
    last_activity_to = params.get('last_activity_to')
    search = params.get('search', '').strip()

    if status:
        queryset = queryset.filter(current_status=status)
    if service_fit:
        queryset = queryset.filter(service_fit=service_fit)
    if country:
        queryset = queryset.filter(country__iexact=country)
    if industry:
        queryset = queryset.filter(industry__iexact=industry)
    if priority:
        queryset = queryset.filter(priority=priority)
    if lead_owner:
        queryset = queryset.filter(lead_owner_id=lead_owner)
    if created_by:
        queryset = queryset.filter(created_by_id=created_by)
    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)
    if next_follow_up_from:
        queryset = queryset.filter(next_follow_up_date__gte=next_follow_up_from)
    if next_follow_up_to:
        queryset = queryset.filter(next_follow_up_date__lte=next_follow_up_to)
    if last_activity_from:
        queryset = queryset.filter(last_activity_date__date__gte=last_activity_from)
    if last_activity_to:
        queryset = queryset.filter(last_activity_date__date__lte=last_activity_to)
    if search:
        queryset = queryset.filter(
            Q(company_name__icontains=search)
            | Q(website__icontains=search)
            | Q(contacts__full_name__icontains=search)
            | Q(contacts__email__icontains=search)
            | Q(contacts__phone__icontains=search)
        ).distinct()

    return queryset


def build_dashboard_stats(queryset):
    stats = {'total': queryset.count()}
    for status_value, _label in Lead.CurrentStatus.choices:
        key = status_value.lower()
        stats[key] = queryset.filter(current_status=status_value).count()
    return stats


def get_recent_leads(queryset, limit=5):
    return queryset.order_by('-updated_at', '-created_at')[:limit]
