from django.db import transaction
from django.db.models import F
from django.utils import timezone

from employees.models import Employee
from policies.models import Policy, PolicyAcknowledgement


def get_active_employees():
    return Employee.objects.filter(status=Employee.Status.ACTIVE)


def get_assigned_employees(policy):
    queryset = get_active_employees()

    if policy.applies_to == Policy.AppliesTo.ALL_EMPLOYEES:
        return queryset
    if policy.applies_to == Policy.AppliesTo.DEPARTMENT:
        departments = policy.applies_to_departments or []
        return queryset.filter(department__in=departments)
    if policy.applies_to == Policy.AppliesTo.DESIGNATION:
        designations = policy.applies_to_designations or []
        return queryset.filter(designation__in=designations)
    if policy.applies_to == Policy.AppliesTo.SPECIFIC_EMPLOYEES:
        employee_ids = policy.applies_to_employees or []
        return queryset.filter(id__in=employee_ids)
    return Employee.objects.none()


def is_policy_assigned_to_employee(policy, employee):
    if employee.status != Employee.Status.ACTIVE:
        return False
    return get_assigned_employees(policy).filter(id=employee.id).exists()


@transaction.atomic
def create_pending_acknowledgements_for_policy(policy):
    if policy.status != Policy.Status.PUBLISHED:
        return 0
    if not policy.requires_acknowledgement:
        return 0

    created_count = 0
    for employee in get_assigned_employees(policy):
        _, created = PolicyAcknowledgement.objects.get_or_create(
            policy=policy,
            employee=employee,
            policy_version=policy.version,
            defaults={'status': PolicyAcknowledgement.Status.PENDING},
        )
        if created:
            created_count += 1
    return created_count


@transaction.atomic
def create_pending_acknowledgements_for_employee(employee):
    if employee.status != Employee.Status.ACTIVE:
        return 0

    created_count = 0
    for policy in Policy.objects.filter(
        status=Policy.Status.PUBLISHED,
        requires_acknowledgement=True,
    ):
        if not is_policy_assigned_to_employee(policy, employee):
            continue
        _, created = PolicyAcknowledgement.objects.get_or_create(
            policy=policy,
            employee=employee,
            policy_version=policy.version,
            defaults={'status': PolicyAcknowledgement.Status.PENDING},
        )
        if created:
            created_count += 1
    return created_count


def get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_client_user_agent(request):
    return request.META.get('HTTP_USER_AGENT', '')[:500]


@transaction.atomic
def acknowledge_policy(policy, employee, request, confirmation_text=''):
    if policy.status != Policy.Status.PUBLISHED:
        raise ValueError('Cannot acknowledge an inactive policy.')
    if not policy.requires_acknowledgement:
        raise ValueError('This policy does not require acknowledgement.')
    if not is_policy_assigned_to_employee(policy, employee):
        raise ValueError('This policy is not assigned to you.')

    acknowledgement = PolicyAcknowledgement.objects.filter(
        policy=policy,
        employee=employee,
        policy_version=policy.version,
    ).first()

    if not acknowledgement:
        acknowledgement = PolicyAcknowledgement.objects.create(
            policy=policy,
            employee=employee,
            policy_version=policy.version,
            status=PolicyAcknowledgement.Status.PENDING,
        )

    if acknowledgement.status == PolicyAcknowledgement.Status.ACKNOWLEDGED:
        raise ValueError('You have already acknowledged this policy version.')

    acknowledgement.status = PolicyAcknowledgement.Status.ACKNOWLEDGED
    acknowledgement.acknowledged_at = timezone.now()
    acknowledgement.ip_address = get_client_ip(request)
    acknowledgement.user_agent = get_client_user_agent(request)
    acknowledgement.confirmation_text = confirmation_text or ''
    acknowledgement.save()
    return acknowledgement


def get_employee_acknowledgement_status(policy, employee):
    ack = PolicyAcknowledgement.objects.filter(
        policy=policy,
        employee=employee,
        policy_version=policy.version,
    ).first()

    if not ack:
        return PolicyAcknowledgement.Status.PENDING
    return ack.status


def build_pending_summary():
    active_policies = Policy.objects.filter(
        status=Policy.Status.PUBLISHED,
        requires_acknowledgement=True,
    )
    active_employees = get_active_employees()
    total_active_policies = active_policies.count()
    total_active_employees = active_employees.count()

    pending_acknowledgements = PolicyAcknowledgement.objects.filter(
        status=PolicyAcknowledgement.Status.PENDING,
        policy__is_active=True,
        policy__version=F('policy_version'),
        employee__status=Employee.Status.ACTIVE,
    ).count()

    acknowledged_count = PolicyAcknowledgement.objects.filter(
        status=PolicyAcknowledgement.Status.ACKNOWLEDGED,
        policy__is_active=True,
        policy__version=F('policy_version'),
        employee__status=Employee.Status.ACTIVE,
    ).count()

    policy_compliance = []
    for policy in active_policies:
        assigned_employee_ids = list(get_assigned_employees(policy).values_list('id', flat=True))
        acks = PolicyAcknowledgement.objects.filter(
            policy=policy,
            policy_version=policy.version,
            employee_id__in=assigned_employee_ids,
        )
        total = len(assigned_employee_ids)
        acknowledged = acks.filter(status=PolicyAcknowledgement.Status.ACKNOWLEDGED).count()
        pending = max(total - acknowledged, 0)
        policy_compliance.append({
            'policy_id': policy.id,
            'policy_title': policy.title,
            'policy_version': policy.version,
            'policy_category': policy.category,
            'effective_date': policy.effective_date,
            'policy_status': policy.status,
            'assigned_employees_count': total,
            'acknowledged': acknowledged,
            'pending': pending,
            'compliance_percent': round((acknowledged / total * 100), 1)
            if total
            else 0,
        })

    employee_pending = []
    for employee in active_employees:
        pending_policies = []
        for policy in active_policies:
            status = get_employee_acknowledgement_status(policy, employee)
            if status == PolicyAcknowledgement.Status.PENDING:
                pending_policies.append({
                    'policy_id': policy.id,
                    'policy_title': policy.title,
                    'policy_version': policy.version,
                })
        if pending_policies:
            employee_pending.append({
                'employee_id': employee.id,
                'employee_code': employee.employee_code,
                'employee_name': employee.full_name,
                'pending_count': len(pending_policies),
                'pending_policies': pending_policies,
            })

    return {
        'total_active_policies': total_active_policies,
        'total_active_employees': total_active_employees,
        'pending_acknowledgements': pending_acknowledgements,
        'acknowledged_count': acknowledged_count,
        'policy_compliance': policy_compliance,
        'employee_pending': employee_pending,
    }
