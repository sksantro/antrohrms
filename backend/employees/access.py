"""Access management: four roles, given by hand or automatically.

- HR / Reporting Manager can come from a designation rule (e.g. "HR Executive" → HR).
- Anyone with people reporting to them is a Reporting Manager.
Automatic roles are added and removed as designations and reporting lines change; roles the Super Admin
set by hand are never touched. Super Admin is never automatic.
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from accounts.models import Role, RoleAssignment

ROLES = [Role.SUPER_ADMIN, Role.HR_OPERATIONS, Role.REPORTING_MANAGER, Role.EMPLOYEE]  # the four in use today; MATRIX columns follow this order
AUTO_ROLES = {Role.HR_OPERATIONS, Role.REPORTING_MANAGER}

# What each role can do — shown on the Access Management page; enforced by each endpoint's permission check.
MATRIX = [
    ("Own attendance, leave, holidays, payslips, profile", ["Yes", "Yes", "Yes", "Yes"]),
    ("Employee directory (add / edit people)", ["Yes", "Edit, no salary", "—", "—"]),
    ("Salary and payroll", ["Yes", "—", "—", "—"]),
    ("Everyone's attendance and live board", ["Yes", "—", "—", "—"]),
    ("Approve leave, WFH and attendance corrections", ["Yes", "—", "—", "—"]),
    ("Holiday calendar", ["Publish", "Draft", "View", "View"]),
    ("Policy Center, audit trail, roles", ["Yes", "—", "—", "—"]),
    ("Direct reports' appraisal (phase 5)", ["Approve", "—", "Review own team", "—"]),
]


def rule_roles(emp) -> set[str]:
    from .models import DesignationRole
    rule = DesignationRole.objects.filter(organization_id=emp.organization_id, designation__iexact=emp.designation.strip()).first()
    return set(rule.roles) & AUTO_ROLES if rule else set()


def auto_roles(emp) -> dict[str, str]:
    """role → source for the roles this person should hold automatically."""
    out = {r: "DESIGNATION" for r in rule_roles(emp)}
    if emp.direct_reports.exclude(status__in=["EXITED", "INACTIVE"]).exists():
        out.setdefault(Role.REPORTING_MANAGER, "REPORTING_LINE")
    return out


def sync(emp) -> None:
    if emp is None or emp.user_id is None:
        return
    want = auto_roles(emp)
    have = {ra.role: ra for ra in RoleAssignment.objects.filter(user_id=emp.user_id)}
    for role, ra in have.items():
        if ra.source != "MANUAL" and role not in want:
            ra.delete()
        elif ra.source != "MANUAL" and ra.source != want[role]:
            RoleAssignment.objects.filter(pk=ra.pk).update(source=want[role])
    for role, source in want.items():
        if role not in have:
            RoleAssignment.objects.create(user_id=emp.user_id, role=role, source=source)
    if Role.EMPLOYEE not in have:
        RoleAssignment.objects.create(user_id=emp.user_id, role=Role.EMPLOYEE, source="MANUAL")
    emp.user.__dict__.pop("_roles", None)


def sync_designation(org, designation: str) -> int:
    from .models import Employee
    people = list(Employee.objects.filter(organization=org, designation__iexact=designation.strip()).select_related("user"))
    for e in people:
        sync(e)
    return len(people)


@receiver(pre_save, sender="employees.Employee")
def _remember_manager(sender, instance, **kwargs):
    old = sender.objects.filter(pk=instance.pk).values_list("reporting_manager_id", flat=True).first() if instance.pk else None
    instance._old_manager_id = old


@receiver(post_save, sender="employees.Employee")
def _sync_after_save(sender, instance, **kwargs):
    sync(instance)
    for mid in {instance.reporting_manager_id, getattr(instance, "_old_manager_id", None)} - {None}:
        sync(sender.objects.filter(pk=mid).select_related("user").first())
