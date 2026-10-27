from django.conf import settings
from django.db import transaction

from accounts.models import Invite, Role, RoleAssignment, User
from common.errors import ConflictError
from common.services import audit, queue_email

from .models import Employee, EmployeeCodeSequence


def issue_employee_code(organization) -> str:
    """Gap-free, collision-free code under a row lock."""
    seq, _ = EmployeeCodeSequence.objects.select_for_update().get_or_create(organization=organization)
    code = f"{seq.prefix}{seq.next_value:04d}"  # same shape as the existing sheet codes, e.g. APT0026
    seq.next_value += 1
    seq.save(update_fields=["next_value"])
    return code


def web_base(request=None) -> str:
    if settings.WEB_BASE_URL:
        return settings.WEB_BASE_URL.rstrip("/")
    return request.build_absolute_uri("/").rstrip("/") if request else "http://localhost:5174"


def send_invite(*, user: User, actor: User, request=None) -> tuple[Invite, str]:
    """Issue a fresh invite, queue the email, and return the link so HR can also share it by hand."""
    invite, token = Invite.issue(user, created_by=actor)
    link = f"{web_base(request)}/activate?token={token}"
    queue_email(
        template_key="ACCOUNT_INVITE",
        recipient=user.email,
        subject="You're invited to Antro HRMS",
        body=(
            f"Hi {user.display_name},\n\n"
            f"An account has been created for you on Antro HRMS. Set your password here (valid for {settings.INVITE_TTL_HOURS} hours):\n\n"
            f"{link}\n\nIf you weren't expecting this, you can ignore this email.\n\n— Antro-Pai Technology"
        ),
        dedupe_key=f"invite:{invite.pk}",
        business_ref=f"user:{user.pk}",
        organization=user.organization,
    )
    audit(actor=actor, action="INVITE_SENT", entity=user, after={"invite_id": str(invite.pk), "expires_at": invite.expires_at.isoformat()}, request=request)
    return invite, link


@transaction.atomic
def create_employee(*, actor: User, data: dict, roles: list[str], request=None) -> tuple[Employee, str]:
    org = actor.organization
    email = data["official_email"].lower()
    if User.objects.filter(email=email).exists():
        raise ConflictError("DUPLICATE_EMAIL", "An account with this email already exists.")
    user = User.objects.create_user(email=email, display_name=data["display_name"], organization=org)
    for role in {Role.EMPLOYEE, *roles}:
        RoleAssignment.objects.create(user=user, role=role, granted_by=actor)
    status = data.get("status") or Employee.Status.PROBATION
    emp = Employee.objects.create(
        organization=org,
        user=user,
        employee_code=None if status == Employee.Status.PREBOARDING else issue_employee_code(org),
        official_email=email,
        **{k: v for k, v in data.items() if k not in {"official_email", "status"}},
        status=status,
    )
    audit(actor=actor, action="EMPLOYEE_CREATED", entity=emp, after={"code": emp.employee_code, "roles": sorted({Role.EMPLOYEE, *roles})}, request=request)
    _, link = send_invite(user=user, actor=actor, request=request)
    return emp, link
