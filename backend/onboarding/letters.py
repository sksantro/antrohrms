"""Official letters: versioned templates, an allow-list of placeholders, HR previews with salary redacted, Super Admin release (BRD §10.3)."""
import hashlib
import re
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from common.errors import BusinessRuleError, ConflictError
from common.services import audit, notify, queue_email, super_admins

from .models import Letter, LetterTemplate

L = Letter.Status
PLACEHOLDER = re.compile(r"\{\{\s*([a-z_.]+)\s*\}\}")
SENSITIVE = {"salary.monthly_gross", "salary.annual_gross", "fnf.net_amount"}
VARS = {"employee.full_name", "employee.code", "employee.designation", "employee.department", "employee.joining_date", "company.legal_name", "letter.date",
        "probation.end_date", "probation.new_end_date", "exit.resignation_date", "exit.last_working_date", "salary.effective_date", "appraisal.rating", "note"} | SENSITIVE
REDACTED = "[confidential: shown only to the Super Admin]"

SIGN = "\n\nFor {{company.legal_name}}\nAuthorised signatory"
DEFAULTS = {
    "APPOINTMENT": ("Appointment letter", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nWe are pleased to appoint you as {{employee.designation}} in the {{employee.department}} team, "
                    "with effect from {{employee.joining_date}}. Your employee code is {{employee.code}}.\n\nYour monthly gross salary is {{salary.monthly_gross}} "
                    "({{salary.annual_gross}} a year). You will be on probation until {{probation.end_date}}.\n\n{{note}}" + SIGN),
    "JOINING_CONFIRMATION": ("Joining confirmation", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nThis confirms that you joined {{company.legal_name}} on {{employee.joining_date}} "
                             "as {{employee.designation}} (employee code {{employee.code}}).\n\n{{note}}" + SIGN),
    "PROBATION_CONFIRMATION": ("Confirmation of employment", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nWe are pleased to confirm that you have completed your probation. "
                               "Your employment as {{employee.designation}} is confirmed with effect from {{probation.end_date}}.\n\n{{note}}" + SIGN),
    "PROBATION_EXTENSION": ("Extension of probation", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nYour probation period has been extended until {{probation.new_end_date}}. "
                            "Your manager will discuss the areas to focus on with you.\n\n{{note}}" + SIGN),
    "SALARY_REVISION": ("Salary revision", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nWe are pleased to inform you that your monthly gross salary is revised to "
                        "{{salary.monthly_gross}} ({{salary.annual_gross}} a year) with effect from {{salary.effective_date}}.\n\n{{note}}" + SIGN),
    "RESIGNATION_ACCEPTANCE": ("Acceptance of resignation", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nWe acknowledge your resignation dated {{exit.resignation_date}}. "
                               "Your last working day will be {{exit.last_working_date}}.\n\n{{note}}" + SIGN),
    "EXPERIENCE": ("Experience letter", "Date: {{letter.date}}\n\nTO WHOM IT MAY CONCERN\n\nThis is to certify that {{employee.full_name}} worked with {{company.legal_name}} as "
                   "{{employee.designation}} from {{employee.joining_date}} to {{exit.last_working_date}}.\n\nWe wish them the very best.\n\n{{note}}" + SIGN),
    "RELIEVING": ("Relieving letter", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nYou are relieved from your duties as {{employee.designation}} at the close of business on "
                  "{{exit.last_working_date}}. All company assets have been returned and the exit formalities are complete.\n\n{{note}}" + SIGN),
    "FNF_STATEMENT": ("Full and final settlement", "Date: {{letter.date}}\n\nDear {{employee.full_name}},\n\nYour full and final settlement up to {{exit.last_working_date}} has been "
                      "approved. Net amount payable: {{fnf.net_amount}}. The detailed statement is attached in Antro HRMS.\n\n{{note}}" + SIGN),
}
TITLES = {k: v[0] for k, v in DEFAULTS.items()}
HR_DRAFTABLE = {"APPOINTMENT", "JOINING_CONFIRMATION", "EXPERIENCE", "RELIEVING", "RESIGNATION_ACCEPTANCE"}


def money(x) -> str:
    return f"₹{Decimal(x):,.2f}"


def check_template(body: str) -> None:
    bad = sorted({m for m in PLACEHOLDER.findall(body) if m not in VARS})
    if bad:
        raise BusinessRuleError("UNKNOWN_PLACEHOLDER", f"These placeholders aren't allowed: {', '.join(bad)}.", field_errors={"body": [f"Allowed: {', '.join(sorted(VARS))}"]})
    if len(body.strip()) < 40:
        raise BusinessRuleError("TEMPLATE_TOO_SHORT", "The letter text is too short.")


def template(org, kind: str) -> LetterTemplate:
    if kind not in DEFAULTS:
        raise BusinessRuleError("INVALID_KIND", "Unknown letter type.")
    t = LetterTemplate.objects.filter(organization=org, kind=kind).order_by("-version").first()
    if t:
        return t
    title, body = DEFAULTS[kind]
    return LetterTemplate.objects.create(organization=org, kind=kind, title=title, body=body)


def save_template(org, kind: str, body: str, actor, request=None) -> LetterTemplate:
    check_template(body)
    cur = template(org, kind)
    if cur.body == body:
        return cur
    t = LetterTemplate.objects.create(organization=org, kind=kind, version=cur.version + 1, title=cur.title, body=body, created_by=actor)
    audit(actor=actor, action="LETTER_TEMPLATE_CHANGED", entity=t, after={"kind": kind, "version": t.version}, request=request, organization=org)
    return t


def context(letter: Letter) -> dict:
    from payroll.models import SalaryVersion
    e = letter.employee
    ctx = {"employee.full_name": e.display_name, "employee.code": e.employee_code or "", "employee.designation": e.designation, "employee.department": e.department.name,
           "employee.joining_date": f"{e.start_date:%d %B %Y}", "company.legal_name": e.organization.legal_name,
           "letter.date": f"{(letter.released_at or timezone.now()):%d %B %Y}", "probation.end_date": f"{e.probation_end:%d %B %Y}", "note": letter.note.strip()}
    ctx.update({k: str(v) for k, v in letter.context.items() if k in VARS and k not in SENSITIVE})
    sv_id = letter.context.get("salary_version_id")
    sv = SalaryVersion.objects.filter(pk=sv_id, employee=e).first() if sv_id else e.salary_versions.filter(effective_from__lte=e.start_date).order_by("-effective_from").first() if letter.kind == "APPOINTMENT" else None
    if sv:
        ctx |= {"salary.monthly_gross": money(sv.monthly_gross), "salary.annual_gross": money(sv.monthly_gross * 12), "salary.effective_date": f"{sv.effective_from:%d %B %Y}"}
    if "fnf_net" in letter.context:
        ctx["fnf.net_amount"] = money(letter.context["fnf_net"])
    return ctx


def render(letter: Letter, redact: bool) -> str:
    ctx = context(letter)

    def sub(m):
        k = m.group(1)
        if redact and k in SENSITIVE:
            return REDACTED
        return ctx.get(k) or ("" if k == "note" else "[not set]")
    return re.sub(r"\n{3,}", "\n\n", PLACEHOLDER.sub(sub, letter.template.body)).strip()


def has_sensitive(letter: Letter) -> bool:
    return any(m in SENSITIVE for m in PLACEHOLDER.findall(letter.template.body))


def draft(employee, kind: str, actor, *, note: str = "", ctx: dict | None = None, source: str = "", request=None) -> Letter:
    t = template(employee.organization, kind)
    lt = Letter.objects.create(organization=employee.organization, employee=employee, kind=kind, template=t, note=note.strip(), context=ctx or {}, source=source, created_by=actor)
    audit(actor=actor, action="LETTER_DRAFTED", entity=lt, after={"kind": kind, "employee_id": str(employee.pk)}, request=request)
    return lt


@transaction.atomic
def submit(lt: Letter, actor, request=None) -> Letter:
    lt = Letter.objects.select_for_update().get(pk=lt.pk)
    if lt.status != L.DRAFT:
        raise ConflictError("NOT_DRAFT", "Only a draft can be sent for approval.")
    if "[not set]" in render(lt, redact=True):
        raise BusinessRuleError("MISSING_VALUES", "Some details in this letter aren't set yet. Check the preview for “[not set]”.")
    lt.status = L.PENDING_ADMIN
    lt.save(update_fields=["status", "updated_at"])
    audit(actor=actor, action="LETTER_SUBMITTED", entity=lt, request=request)
    notify(list(super_admins(lt.organization)), f"Letter to approve: {TITLES[lt.kind]} for {lt.employee.display_name}", "", "/console/letters")
    return lt


@transaction.atomic
def release(lt: Letter, actor, request=None) -> Letter:
    """Freeze the content (SHA-256) and send it once. Callers check that the actor is a Super Admin."""
    lt = Letter.objects.select_for_update().get(pk=lt.pk)
    if lt.status == L.RELEASED:
        return lt
    lt.released_at = timezone.now()
    lt.content = render(lt, redact=False)
    if "[not set]" in lt.content:
        raise BusinessRuleError("MISSING_VALUES", "Some details in this letter aren't set yet (for example the salary). Fix them before approving.")
    lt.digest = hashlib.sha256(lt.content.encode()).hexdigest()
    lt.status, lt.approved_by = L.RELEASED, actor
    lt.save()
    audit(actor=actor, action="LETTER_RELEASED", entity=lt, after={"kind": lt.kind, "digest": lt.digest}, request=request)
    e = lt.employee
    title = TITLES[lt.kind]
    # Formal documents go by email; salary-bearing ones only point to the app (no salary in email bodies).
    body = f"Dear {e.display_name},\n\nYour {title.lower()} is ready in Antro HRMS → Documents." if has_sensitive(lt) else f"{lt.content}\n\nSHA-256: {lt.digest}"
    queue_email(template_key="letter", recipient=e.official_email, subject=f"{title} — {e.organization.legal_name}", body=body, dedupe_key=f"letter:{lt.pk}", organization=e.organization)
    notify(e.user, f"Your {title.lower()} is ready", "", "/app/documents", tone="success")
    return lt


@transaction.atomic
def decide(lt: Letter, actor, decision: str, note: str, request=None) -> Letter:
    lt = Letter.objects.select_for_update().get(pk=lt.pk)
    if lt.status != L.PENDING_ADMIN:
        raise ConflictError("NOT_PENDING", "This letter isn't waiting for approval.")
    note = note.strip()
    if decision == "APPROVE":
        lt.admin_note = note
        lt.save(update_fields=["admin_note"])
        return release(lt, actor, request)
    if len(note) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Tell HR what to change.")
    lt.status = L.DRAFT if decision == "NEEDS_CHANGES" else L.REJECTED
    lt.admin_note = note
    lt.save(update_fields=["status", "admin_note", "updated_at"])
    audit(actor=actor, action=f"LETTER_{decision}", entity=lt, reason=note, request=request)
    notify([lt.created_by], f"{TITLES[lt.kind]} for {lt.employee.display_name}: {'needs changes' if decision == 'NEEDS_CHANGES' else 'rejected'}", note, "/hr/letters", tone="warning")
    return lt
