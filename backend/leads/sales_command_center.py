from datetime import date, datetime

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone

from attendance.models import Attendance
from employees.models import Employee
from leads.kpi import get_kpi_summary, get_period_bounds
from leads.models import Lead, LeadActivity, LeadContact, LeadStatusChange

User = get_user_model()

COMMAND_CENTER_PERIODS = frozenset({'daily', 'weekly', 'monthly'})


def parse_reference_date(value: str | None) -> date:
    if not value:
        return timezone.localdate()
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValueError('Invalid date format. Use YYYY-MM-DD.') from exc


def get_sales_team_users():
    return (
        User.objects.filter(
            employee_profile__department=Employee.Department.SALES_MARKETING,
            employee_profile__status=Employee.Status.ACTIVE,
            is_active=True,
        )
        .select_related('employee_profile')
        .order_by('full_name', 'email')
    )


def get_overall_kpi_status(metrics: list[dict]) -> str:
    if not metrics:
        return 'Not Matched'
    if all(metric['status'] == 'Matched' for metric in metrics):
        return 'Matched'
    if any(metric['completed'] > 0 for metric in metrics):
        return 'At Risk'
    return 'Not Matched'


def _lead_scope_q(service_fit: str | None = None, lead_status: str | None = None) -> Q:
    scope = Q()
    if service_fit:
        scope &= Q(service_fit=service_fit)
    if lead_status:
        scope &= Q(current_status=lead_status)
    return scope


def _count_completed_metrics(
    user,
    start_date: date,
    end_date: date,
    service_fit: str | None = None,
    lead_status: str | None = None,
) -> dict:
    lead_scope = _lead_scope_q(service_fit, lead_status)

    new_leads = Lead.objects.filter(
        lead_scope,
        lead_owner=user,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).count()

    decision_makers = LeadContact.objects.filter(
        lead_scope,
        lead__lead_owner=user,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).count()

    activity_filter = Q(
        created_by=user,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
        is_countable_for_kpi=True,
        is_deleted=False,
    )
    if service_fit:
        activity_filter &= Q(lead__service_fit=service_fit)
    if lead_status:
        activity_filter &= Q(lead__current_status=lead_status)

    activity_counts = {
        row['activity_type']: row['count']
        for row in LeadActivity.objects.filter(activity_filter)
        .values('activity_type')
        .annotate(count=Count('id'))
    }

    status_change_filter = Q(
        changed_by=user,
        new_status=Lead.CurrentStatus.INTERESTED,
        changed_at__date__gte=start_date,
        changed_at__date__lte=end_date,
        is_countable_for_kpi=True,
    )
    if service_fit:
        status_change_filter &= Q(lead__service_fit=service_fit)
    if lead_status:
        status_change_filter &= Q(lead__current_status=lead_status)

    interested_leads = LeadStatusChange.objects.filter(status_change_filter).count()

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


def _team_user_ids(users=None):
    if users is None:
        users = get_sales_team_users()
    return list(users.values_list('id', flat=True))


def _count_team_on_date(
    target_date: date,
    user_ids: list[int],
    service_fit: str | None = None,
    lead_status: str | None = None,
) -> dict:
    lead_scope = _lead_scope_q(service_fit, lead_status)

    leads_added = Lead.objects.filter(
        lead_scope,
        lead_owner_id__in=user_ids,
        created_at__date=target_date,
    ).count()

    decision_makers = LeadContact.objects.filter(
        lead_scope,
        lead__lead_owner_id__in=user_ids,
        created_at__date=target_date,
    ).count()

    activity_filter = Q(
        created_by_id__in=user_ids,
        created_at__date=target_date,
        is_countable_for_kpi=True,
        is_deleted=False,
    )
    if service_fit:
        activity_filter &= Q(lead__service_fit=service_fit)
    if lead_status:
        activity_filter &= Q(lead__current_status=lead_status)

    activity_counts = {
        row['activity_type']: row['count']
        for row in LeadActivity.objects.filter(activity_filter)
        .values('activity_type')
        .annotate(count=Count('id'))
    }

    status_change_filter = Q(
        changed_by_id__in=user_ids,
        new_status=Lead.CurrentStatus.INTERESTED,
        changed_at__date=target_date,
        is_countable_for_kpi=True,
    )
    if service_fit:
        status_change_filter &= Q(lead__service_fit=service_fit)
    if lead_status:
        status_change_filter &= Q(lead__current_status=lead_status)

    interested_leads = LeadStatusChange.objects.filter(status_change_filter).count()

    return {
        'leads_added': leads_added,
        'decision_makers_added': decision_makers,
        'linkedin_outreach': activity_counts.get(LeadActivity.ActivityType.LINKEDIN_MESSAGE_SENT, 0),
        'cold_calls': activity_counts.get(LeadActivity.ActivityType.COLD_CALL_MADE, 0),
        'follow_ups': activity_counts.get(LeadActivity.ActivityType.FOLLOW_UP_DONE, 0),
        'interested_leads': interested_leads,
        'meetings_booked': activity_counts.get(LeadActivity.ActivityType.MEETING_DEMO_BOOKED, 0),
        'proposal_sent': activity_counts.get(LeadActivity.ActivityType.PROPOSAL_SENT, 0),
    }


def _count_not_counted_activities(target_date: date, user_ids: list[int]) -> int:
    activity_count = LeadActivity.objects.filter(
        created_by_id__in=user_ids,
        created_at__date=target_date,
        is_countable_for_kpi=False,
        is_deleted=False,
    ).count()
    status_count = LeadStatusChange.objects.filter(
        changed_by_id__in=user_ids,
        changed_at__date=target_date,
        is_countable_for_kpi=False,
    ).count()
    return activity_count + status_count


def _serialize_sales_employee(user) -> dict:
    department = None
    try:
        department = user.employee_profile.department
    except Employee.DoesNotExist:
        pass
    return {
        'id': user.id,
        'full_name': user.full_name or user.email,
        'email': user.email,
        'department': department,
    }


def get_checkout_status(user, target_date: date) -> dict:
    try:
        employee = user.employee_profile
    except Employee.DoesNotExist:
        return {
            'status': 'No Employee Profile',
            'checked_out': False,
            'has_daily_report': False,
            'kpi_matched': None,
            'kpi_miss_reason': '',
        }

    attendance = (
        Attendance.objects.filter(employee=employee, date=target_date)
        .only('check_in_time', 'check_out_time', 'status', 'daily_report_summary', 'kpi_snapshot', 'kpi_miss_reason')
        .first()
    )
    if not attendance:
        return {
            'status': 'No Record',
            'checked_out': False,
            'has_daily_report': False,
            'kpi_matched': None,
            'kpi_miss_reason': '',
        }

    if attendance.check_out_time:
        snapshot_metrics = (attendance.kpi_snapshot or {}).get('metrics', [])
        has_unmatched = any(metric.get('status') == 'Not Matched' for metric in snapshot_metrics)
        return {
            'status': 'Checked Out',
            'checked_out': True,
            'has_daily_report': bool(attendance.daily_report_summary),
            'kpi_matched': not has_unmatched,
            'kpi_miss_reason': attendance.kpi_miss_reason or '',
        }

    if attendance.check_in_time:
        return {
            'status': 'Checked In',
            'checked_out': False,
            'has_daily_report': False,
            'kpi_matched': None,
            'kpi_miss_reason': '',
        }

    return {
        'status': attendance.get_status_display(),
        'checked_out': False,
        'has_daily_report': False,
        'kpi_matched': None,
        'kpi_miss_reason': '',
    }


def get_team_summary(
    reference_date: date | None = None,
    service_fit: str | None = None,
    lead_status: str | None = None,
) -> dict:
    target_date = reference_date or timezone.localdate()
    sales_users = get_sales_team_users()
    user_ids = _team_user_ids(sales_users)
    lead_scope = _lead_scope_q(service_fit, lead_status)

    total_leads = Lead.objects.filter(lead_scope, lead_owner_id__in=user_ids).count()
    day_counts = _count_team_on_date(target_date, user_ids, service_fit, lead_status)

    matched_employees = 0
    missed_employees = 0
    for user in sales_users:
        daily_summary = get_kpi_summary(user, period='daily', reference_date=target_date)
        overall_status = get_overall_kpi_status(daily_summary['metrics'])
        if overall_status == 'Matched':
            matched_employees += 1
        else:
            missed_employees += 1

    return {
        'date': target_date.isoformat(),
        'total_sales_employees': len(user_ids),
        'total_leads': total_leads,
        'leads_added_today': day_counts['leads_added'],
        'decision_makers_added_today': day_counts['decision_makers_added'],
        'calls_today': day_counts['cold_calls'],
        'linkedin_outreach_today': day_counts['linkedin_outreach'],
        'follow_ups_today': day_counts['follow_ups'],
        'interested_leads_today': day_counts['interested_leads'],
        'meetings_booked': day_counts['meetings_booked'],
        'proposal_sent': day_counts['proposal_sent'],
        'kpi_matched_employees': matched_employees,
        'kpi_missed_employees': missed_employees,
        'suspicious_not_counted_activities': _count_not_counted_activities(target_date, user_ids),
        'sales_employees': [_serialize_sales_employee(user) for user in sales_users],
    }


def get_employee_kpi_rows(
    reference_date: date | None = None,
    period: str = 'daily',
    employee_id: int | None = None,
    kpi_status: str | None = None,
    service_fit: str | None = None,
    lead_status: str | None = None,
) -> dict:
    if period not in COMMAND_CENTER_PERIODS:
        raise ValueError('Invalid period. Use daily, weekly, or monthly.')

    target_date = reference_date or timezone.localdate()
    start_date, end_date = get_period_bounds(period, target_date)

    sales_users = get_sales_team_users()
    if employee_id:
        sales_users = sales_users.filter(id=employee_id)

    rows = []
    for user in sales_users:
        counts = _count_completed_metrics(user, start_date, end_date, service_fit, lead_status)
        daily_summary = get_kpi_summary(user, period='daily', reference_date=target_date)
        overall_status = get_overall_kpi_status(daily_summary['metrics'])

        if kpi_status:
            normalized = kpi_status.lower().replace(' ', '_')
            if normalized == 'matched' and overall_status != 'Matched':
                continue
            if normalized in {'missed', 'not_matched'} and overall_status == 'Matched':
                continue
            if normalized == 'at_risk' and overall_status != 'At Risk':
                continue

        rows.append({
            'employee_id': user.id,
            'employee_name': user.full_name or user.email,
            'department': getattr(getattr(user, 'employee_profile', None), 'department', None),
            'leads': counts['new-company-leads'],
            'decision_makers': counts['decision-maker-contacts'],
            'linkedin': counts['linkedin-outreach'],
            'calls': counts['cold-calls'],
            'follow_ups': counts['follow-ups'],
            'interested_leads': counts['interested-leads'],
            'meetings': counts['meetings-booked'],
            'proposal_sent': counts['proposal-sent'],
            'kpi_status': overall_status,
            'last_checkout_status': get_checkout_status(user, target_date),
        })

    return {
        'date': target_date.isoformat(),
        'period': period,
        'period_start': start_date.isoformat(),
        'period_end': end_date.isoformat(),
        'rows': rows,
    }


def get_employee_detail(
    user_id: int,
    reference_date: date | None = None,
    period: str = 'daily',
) -> dict:
    if period not in COMMAND_CENTER_PERIODS:
        raise ValueError('Invalid period. Use daily, weekly, or monthly.')

    target_date = reference_date or timezone.localdate()
    user = get_sales_team_users().filter(id=user_id).first()
    if not user:
        raise ValueError('Sales employee not found.')

    start_date, end_date = get_period_bounds(period, target_date)
    kpi_summary = get_kpi_summary(user, period=period, reference_date=target_date)

    leads_owned = list(
        Lead.objects.filter(lead_owner=user)
        .order_by('-updated_at')[:25]
        .values('id', 'company_name', 'current_status', 'service_fit', 'priority', 'next_follow_up_date')
    )

    activities_done = list(
        LeadActivity.objects.filter(
            created_by=user,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        .select_related('lead')
        .order_by('-created_at')[:30]
        .values(
            'id',
            'activity_type',
            'notes',
            'status',
            'is_countable_for_kpi',
            'created_at',
            'lead_id',
            'lead__company_name',
        )
    )

    today = timezone.localdate()
    follow_ups_pending = list(
        Lead.objects.filter(lead_owner=user)
        .filter(
            Q(current_status=Lead.CurrentStatus.FOLLOW_UP_REQUIRED)
            | Q(next_follow_up_date__lte=today)
        )
        .exclude(current_status__in=[Lead.CurrentStatus.CLOSED, Lead.CurrentStatus.LOST])
        .order_by('next_follow_up_date', '-updated_at')[:25]
        .values('id', 'company_name', 'current_status', 'next_follow_up_date', 'priority')
    )

    checkout_report = None
    try:
        attendance = Attendance.objects.filter(
            employee=user.employee_profile,
            date=target_date,
        ).first()
        if attendance and (attendance.daily_report_summary or attendance.kpi_snapshot):
            checkout_report = {
                'date': target_date.isoformat(),
                'check_in_time': attendance.check_in_time.isoformat() if attendance.check_in_time else None,
                'check_out_time': attendance.check_out_time.isoformat() if attendance.check_out_time else None,
                'daily_report_summary': attendance.daily_report_summary,
                'tomorrow_plan': attendance.tomorrow_plan,
                'kpi_snapshot': attendance.kpi_snapshot,
                'kpi_miss_reason': attendance.kpi_miss_reason,
            }
    except Employee.DoesNotExist:
        pass

    not_counted_activities = list(
        LeadActivity.objects.filter(
            created_by=user,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            is_countable_for_kpi=False,
        )
        .select_related('lead')
        .order_by('-created_at')[:30]
        .values(
            'id',
            'activity_type',
            'notes',
            'created_at',
            'lead_id',
            'lead__company_name',
        )
    )

    not_counted_status_changes = list(
        LeadStatusChange.objects.filter(
            changed_by=user,
            changed_at__date__gte=start_date,
            changed_at__date__lte=end_date,
            is_countable_for_kpi=False,
        )
        .select_related('lead')
        .order_by('-changed_at')[:20]
        .values(
            'id',
            'previous_status',
            'new_status',
            'changed_at',
            'lead_id',
            'lead__company_name',
        )
    )

    return {
        'employee': _serialize_sales_employee(user),
        'date': target_date.isoformat(),
        'period': period,
        'period_start': start_date.isoformat(),
        'period_end': end_date.isoformat(),
        'kpi_summary': kpi_summary,
        'last_checkout_status': get_checkout_status(user, target_date),
        'leads_owned': leads_owned,
        'activities_done': activities_done,
        'follow_ups_pending': follow_ups_pending,
        'checkout_report': checkout_report,
        'not_counted_activities': not_counted_activities,
        'not_counted_status_changes': not_counted_status_changes,
    }
