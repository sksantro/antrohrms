from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from leads.models import Lead, LeadActivity, LeadContact, LeadStatusChange

VALID_PERIODS = frozenset({'daily', 'weekly', 'monthly', 'quarterly'})

KPI_METRICS_BY_PERIOD = {
    'daily': (
        {'id': 'new-company-leads', 'label': 'New Company Leads', 'target_min': 50, 'target_max': 50},
        {'id': 'decision-maker-contacts', 'label': 'Decision Maker Contacts', 'target_min': 20, 'target_max': 20},
        {'id': 'linkedin-outreach', 'label': 'LinkedIn Outreach Messages', 'target_min': 25, 'target_max': 25},
        {'id': 'cold-calls', 'label': 'Cold Calls', 'target_min': 15, 'target_max': 15},
        {'id': 'follow-ups', 'label': 'Follow-ups Completed', 'target_min': 10, 'target_max': 10},
        {'id': 'interested-leads', 'label': 'Interested Leads', 'target_min': 2, 'target_max': 2},
    ),
    'weekly': (
        {'id': 'new-company-leads', 'label': 'New Company Leads', 'target_min': 250, 'target_max': 250},
        {'id': 'decision-maker-contacts', 'label': 'Decision Maker Contacts', 'target_min': 100, 'target_max': 100},
        {'id': 'cold-calls', 'label': 'Cold Calls', 'target_min': 75, 'target_max': 75},
        {'id': 'linkedin-outreach', 'label': 'LinkedIn Outreach Messages', 'target_min': 100, 'target_max': 125},
        {'id': 'interested-leads', 'label': 'Interested Leads', 'target_min': 10, 'target_max': 15},
        {'id': 'meetings-booked', 'label': 'Meetings/Demo Calls Booked', 'target_min': 3, 'target_max': 5},
    ),
    'monthly': (
        {'id': 'new-company-leads', 'label': 'New Company Leads', 'target_min': 1000, 'target_max': 1000},
        {'id': 'decision-maker-contacts', 'label': 'Decision Maker Contacts', 'target_min': 400, 'target_max': 400},
        {'id': 'cold-calls', 'label': 'Cold Calls', 'target_min': 300, 'target_max': 300},
        {'id': 'linkedin-outreach', 'label': 'LinkedIn Outreach Messages', 'target_min': 400, 'target_max': 500},
        {'id': 'interested-leads', 'label': 'Interested Leads', 'target_min': 40, 'target_max': 50},
        {'id': 'meetings-booked', 'label': 'Meetings Booked', 'target_min': 12, 'target_max': 20},
        {
            'id': 'proposal-sent',
            'label': 'Serious Opportunities moved to Proposal Sent',
            'target_min': 2,
            'target_max': 4,
        },
    ),
    'quarterly': (
        {'id': 'new-company-leads', 'label': 'New Company Leads', 'target_min': 3000, 'target_max': 3000},
        {'id': 'decision-maker-contacts', 'label': 'Decision Maker Contacts', 'target_min': 1200, 'target_max': 1200},
        {'id': 'cold-calls', 'label': 'Cold Calls', 'target_min': 900, 'target_max': 900},
        {'id': 'linkedin-outreach', 'label': 'LinkedIn Outreach Messages', 'target_min': 1200, 'target_max': 1500},
        {'id': 'interested-leads', 'label': 'Interested Leads', 'target_min': 120, 'target_max': 150},
        {'id': 'meetings-booked', 'label': 'Meetings Booked', 'target_min': 36, 'target_max': 60},
        {
            'id': 'proposal-sent',
            'label': 'Serious Opportunities moved to Proposal Sent',
            'target_min': 6,
            'target_max': 12,
        },
    ),
}

# Backward-compatible alias used by checkout snapshot logic.
DAILY_KPI_METRICS = KPI_METRICS_BY_PERIOD['daily']


def format_target(target_min: int, target_max: int) -> str:
    if target_min == target_max:
        return str(target_min)
    return f'{target_min}–{target_max}'


def evaluate_status(completed: int, target_min: int) -> str:
    return 'Matched' if completed >= target_min else 'Not Matched'


def get_period_bounds(period: str, reference_date=None):
    today = reference_date or timezone.localdate()

    if period == 'daily':
        return today, today

    if period == 'weekly':
        week_start = today - timedelta(days=today.weekday())
        return week_start, today

    if period == 'monthly':
        return today.replace(day=1), today

    if period == 'quarterly':
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=quarter_start_month, day=1), today

    raise ValueError(f'Unsupported KPI period: {period}')


def _count_completed_metrics(user, start_date, end_date) -> dict:
    new_leads = Lead.objects.filter(
        lead_owner=user,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).count()

    decision_makers = LeadContact.objects.filter(
        lead__lead_owner=user,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).count()

    activity_counts = {
        row['activity_type']: row['count']
        for row in LeadActivity.objects.filter(
            created_by=user,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            is_countable_for_kpi=True,
            is_deleted=False,
        )
        .values('activity_type')
        .annotate(count=Count('id'))
    }

    interested_leads = LeadStatusChange.objects.filter(
        changed_by=user,
        new_status=Lead.CurrentStatus.INTERESTED,
        changed_at__date__gte=start_date,
        changed_at__date__lte=end_date,
        is_countable_for_kpi=True,
    ).count()

    return {
        'new-company-leads': new_leads,
        'decision-maker-contacts': decision_makers,
        'linkedin-outreach': activity_counts.get(LeadActivity.ActivityType.LINKEDIN_MESSAGE_SENT, 0),
        'cold-calls': activity_counts.get(LeadActivity.ActivityType.COLD_CALL_MADE, 0),
        'follow-ups': activity_counts.get(LeadActivity.ActivityType.FOLLOW_UP_DONE, 0),
        'interested-leads': interested_leads,
        'meetings-booked': activity_counts.get(LeadActivity.ActivityType.MEETING_DEMO_BOOKED, 0),
        'proposal-sent': activity_counts.get(LeadActivity.ActivityType.PROPOSAL_SENT, 0),
    }


def get_kpi_summary(user, period: str = 'daily', reference_date=None):
    if period not in VALID_PERIODS:
        raise ValueError(f'Unsupported KPI period: {period}')

    start_date, end_date = get_period_bounds(period, reference_date)
    completed_by_id = _count_completed_metrics(user, start_date, end_date)

    metrics = []
    for metric in KPI_METRICS_BY_PERIOD[period]:
        completed = completed_by_id.get(metric['id'], 0)
        target_min = metric['target_min']
        target_max = metric['target_max']
        metrics.append({
            'id': metric['id'],
            'label': metric['label'],
            'target': format_target(target_min, target_max),
            'target_min': target_min,
            'target_max': target_max,
            'completed': completed,
            'status': evaluate_status(completed, target_min),
        })

    summary = {
        'period': period,
        'date': end_date.isoformat(),
        'period_start': start_date.isoformat(),
        'period_end': end_date.isoformat(),
        'metrics': metrics,
    }

    if period == 'daily':
        from leads.sales_command_center import get_checkout_status

        checkout = get_checkout_status(user, end_date)
        summary['daily_report_submitted'] = checkout['has_daily_report']

    return summary


def get_daily_kpi_summary(user):
    return get_kpi_summary(user, period='daily')
