"""Assets, resignation, exit checklist and full & final (BRD §11, §12). Write-offs, recoveries and money are Super Admin only; nothing is deducted automatically."""
import calendar
import hashlib
import json
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User
from attendance.services import policy
from common.errors import BusinessRuleError, ConflictError
from common.services import audit, notify, queue_email, super_admins
from employees.models import Employee
from onboarding import letters

from .models import Allocation, Asset, ExitCase, Resignation, Settlement

A = Asset.State
R = Resignation.Status
INACTIVE = ("EXITED", "INACTIVE", "PREBOARDING")
EXIT_CHECKLIST = [("handover", "Work handed over"), ("documents", "Company documents and data returned"), ("it_access", "IT access list prepared for revocation"),
                  ("attendance", "Final attendance and leave reconciled")]
ZERO = Decimal("0")


def _hr(org):
    return list(User.objects.filter(organization=org, is_active=True, role_assignments__role=Role.HR_OPERATIONS).distinct())


def today() -> date:
    return timezone.localdate()


# ---------- assets ----------
def create_asset(org, actor, data: dict, admin: bool, request=None) -> Asset:
    tag = (data.get("tag") or "").strip()
    if len(tag) < 2 or len((data.get("make_model") or "").strip()) < 2:
        raise BusinessRuleError("DETAILS_REQUIRED", "Enter the asset tag and make / model.")
    if Asset.objects.filter(organization=org, tag__iexact=tag).exists():
        raise ConflictError("DUPLICATE_TAG", f"Tag {tag} is already used.", field_errors={"tag": ["Already used."]})
    cat = data.get("category")
    if cat not in Asset.Category.values:
        raise BusinessRuleError("INVALID_CATEGORY", "Pick a category.")
    owner = data.get("owner")
    if cat == Asset.Category.PERSONAL_DEVICE and owner is None:
        raise BusinessRuleError("OWNER_REQUIRED", "Pick whose personal device this is.")
    a = Asset.objects.create(organization=org, category=cat, make_model=data["make_model"].strip(), tag=tag, serial=(data.get("serial") or "").strip(),
                             purchase_ref=(data.get("purchase_ref") or "").strip(), location=(data.get("location") or "").strip(),
                             cost=data.get("cost") if admin else None, owner=owner if cat == Asset.Category.PERSONAL_DEVICE else None, created_by=actor)
    audit(actor=actor, action="ASSET_CREATED", entity=a, after={"tag": a.tag, "category": a.category}, request=request)
    return a


@transaction.atomic
def assign(asset: Asset, employee: Employee, actor, note: str = "", request=None) -> Allocation:
    asset = Asset.objects.select_for_update().get(pk=asset.pk)
    if asset.category == Asset.Category.PERSONAL_DEVICE:
        raise BusinessRuleError("PERSONAL_DEVICE", "A personal device isn't a company asset, so it can't be assigned.")
    if asset.state != A.AVAILABLE:
        raise ConflictError("NOT_AVAILABLE", f"{asset.tag} isn't available ({asset.get_state_display().lower()}).")
    if employee.status in INACTIVE or employee.organization_id != asset.organization_id:
        raise BusinessRuleError("INVALID_EMPLOYEE", "Assign to a current employee.")
    if employee.status == Employee.Status.NOTICE_PERIOD:
        raise BusinessRuleError("ON_NOTICE", "This person is serving notice. Don't hand out new assets now.")
    al = Allocation.objects.create(organization=asset.organization, asset=asset, employee=employee, assigned_by=actor, assign_note=note.strip()[:300])
    asset.state = A.ASSIGNED
    asset.save(update_fields=["state"])
    audit(actor=actor, action="ASSET_ASSIGNED", entity=asset, after={"employee_id": str(employee.pk)}, request=request)
    notify(employee.user, f"Please acknowledge: {asset.get_category_display()} {asset.tag}", asset.make_model, "/app/assets")
    return al


@transaction.atomic
def acknowledge(al: Allocation, employee: Employee, typed: str, note: str = "", request=None) -> Allocation:
    al = Allocation.objects.select_for_update().select_related("asset").get(pk=al.pk)
    if al.employee_id != employee.pk:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if al.ack_at:
        raise ConflictError("ALREADY_ACKNOWLEDGED", "You already acknowledged this.")
    if al.closed_at or al.return_started_at:
        raise ConflictError("CLOSED", "This hand-over is closed.")
    if typed.strip().lower() != al.asset.tag.lower():
        raise BusinessRuleError("CONFIRMATION_MISMATCH", f"Type the asset tag ({al.asset.tag}) to confirm you received it.", field_errors={"typed": ["Must match the tag."]})
    al.ack_at, al.ack_note = timezone.now(), note.strip()[:300]
    al.save(update_fields=["ack_at", "ack_note"])
    audit(actor=employee.user, action="ASSET_ACKNOWLEDGED", entity=al.asset, request=request)
    return al


@transaction.atomic
def start_return(al: Allocation, actor, request=None) -> Allocation:
    al = Allocation.objects.select_for_update().select_related("asset").get(pk=al.pk)
    if al.closed_at or al.return_started_at:
        raise ConflictError("ALREADY_RETURNING", "Return already started or closed.")
    al.return_started_at = timezone.now()
    al.save(update_fields=["return_started_at"])
    Asset.objects.filter(pk=al.asset_id).update(state=A.RETURN_PENDING)
    audit(actor=actor, action="ASSET_RETURN_STARTED", entity=al.asset, request=request)
    notify(al.employee.user, f"Return {al.asset.tag}", "Hand it to HR; you'll both confirm the condition.", "/app/assets")
    return al


@transaction.atomic
def record_return(al: Allocation, actor, condition: str, note: str, request=None) -> Allocation:
    al = Allocation.objects.select_for_update().select_related("asset").get(pk=al.pk)
    if not al.return_started_at or al.closed_at:
        raise ConflictError("NOT_RETURNING", "Start the return first.")
    if al.hr_ack_at:
        raise ConflictError("ALREADY_RECORDED", "HR already recorded this return.")
    if condition not in Allocation.Condition.values:
        raise BusinessRuleError("INVALID_CONDITION", "Choose good, damaged or missing.")
    if condition != "GOOD" and len(note.strip()) < 5:
        raise BusinessRuleError("NOTE_REQUIRED", "Describe the damage or what's missing.", field_errors={"note": ["Required."]})
    al.condition, al.return_note, al.hr_ack_by, al.hr_ack_at = condition, note.strip()[:300], actor, timezone.now()
    al.save()
    audit(actor=actor, action="ASSET_RETURN_RECORDED", entity=al.asset, after={"condition": condition}, request=request)
    notify(al.employee.user, f"Confirm the return of {al.asset.tag}", f"HR recorded it as {condition.lower()}.", "/app/assets")
    return al


@transaction.atomic
def confirm_return(al: Allocation, employee: Employee, agrees: bool, note: str = "", request=None) -> Allocation:
    al = Allocation.objects.select_for_update().select_related("asset").get(pk=al.pk)
    if al.employee_id != employee.pk:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if not al.hr_ack_at or al.emp_ack_at:
        raise ConflictError("NOT_READY", "HR hasn't recorded the return yet, or you already confirmed it.")
    if not agrees and len(note.strip()) < 5:
        raise BusinessRuleError("NOTE_REQUIRED", "Say what you disagree with.", field_errors={"note": ["Required."]})
    al.emp_ack_at, al.emp_agrees, al.emp_note = timezone.now(), agrees, note.strip()[:300]
    asset = Asset.objects.select_for_update().get(pk=al.asset_id)
    if agrees and al.condition == "GOOD":
        al.closed_at, asset.state = timezone.now(), A.AVAILABLE
    else:
        al.disputed, asset.state = True, A.RETURNED
        notify(list(super_admins(al.organization)), f"Asset decision: {asset.tag}", f"{al.condition.lower()}{'' if agrees else ', employee disagrees'}", "/console/assets")
    al.save()
    asset.save(update_fields=["state"])
    audit(actor=employee.user, action="ASSET_RETURN_CONFIRMED", entity=asset, after={"agrees": agrees, "condition": al.condition}, request=request)
    return al


@transaction.atomic
def resolve(al: Allocation, actor, decision: str, note: str, request=None) -> Allocation:
    """Super Admin only. RECOVERY_REVIEW only flags the case for the F&F; nothing is deducted automatically."""
    al = Allocation.objects.select_for_update().select_related("asset").get(pk=al.pk)
    if not al.disputed or al.closed_at:
        raise ConflictError("NOT_DISPUTED", "Nothing to decide here.")
    if decision not in ("ACCEPT", "WRITE_OFF", "RECOVERY_REVIEW"):
        raise BusinessRuleError("INVALID_DECISION", "Accept, write off or flag for recovery review.")
    if len(note.strip()) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Add a note for the record.")
    asset = Asset.objects.select_for_update().get(pk=al.asset_id)
    asset.state = A.AVAILABLE if decision == "ACCEPT" else A.WRITTEN_OFF if decision == "WRITE_OFF" or al.condition == "MISSING" else A.RETURNED
    al.admin_decision, al.admin_note, al.closed_at = decision, note.strip()[:300], timezone.now()
    al.save()
    asset.save(update_fields=["state"])
    audit(actor=actor, action=f"ASSET_{decision}", entity=asset, reason=note, request=request)
    return al


def set_asset_state(asset: Asset, actor, state: str, note: str, request=None) -> Asset:
    """Super Admin: put a returned asset back in service, or write it off."""
    if asset.state not in (A.RETURNED, A.AVAILABLE) or state not in (A.AVAILABLE, A.WRITTEN_OFF):
        raise ConflictError("INVALID_STATE", "Only an available or returned asset can be put back in service or written off.")
    if len(note.strip()) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Add a note for the record.")
    before = asset.state
    asset.state = state
    asset.save(update_fields=["state"])
    audit(actor=actor, action="ASSET_STATE_CHANGED", entity=asset, before={"state": before}, after={"state": state}, reason=note, request=request)
    return asset


def open_assets(employee: Employee):
    return Allocation.objects.filter(employee=employee, closed_at__isnull=True).select_related("asset")


# ---------- resignation ----------
def notice_days(org) -> int:
    return int(policy(org, "employees.notice_days", 30))


def resignation_letter(emp: Employee, reason: str, submitted: date, last_day: date) -> str:
    return (f"Date: {submitted:%d %B %Y}\n\nTo: {emp.organization.legal_name}\n\nSubject: Resignation\n\n"
            f"I, {emp.display_name} ({emp.employee_code or 'no code'}), {emp.designation} in the {emp.department.name} team, resign from my position.\n\n"
            f"Reason: {reason.strip()}\n\nMy proposed last working day is {last_day:%d %B %Y}.\n\nI will complete the handover and return all company assets.\n\n{emp.display_name}")


def _check_dates(emp: Employee, last_day: date):
    t = today()
    if last_day < t:
        raise BusinessRuleError("LAST_DAY_PASSED", "The last working day can't be in the past.", field_errors={"proposed_last_day": ["Today or later."]})
    if last_day > t + timedelta(days=180):
        raise BusinessRuleError("LAST_DAY_TOO_FAR", "Pick a last working day within 6 months.")
    if last_day < emp.start_date:
        raise BusinessRuleError("BEFORE_JOINING", "That's before your joining date.")


@transaction.atomic
def submit_resignation(emp: Employee, *, reason: str, proposed_last_day: date, own_letter=None, request=None) -> Resignation:
    emp = Employee.objects.select_for_update().get(pk=emp.pk)
    if emp.status not in (Employee.Status.PROBATION, Employee.Status.ACTIVE_CONFIRMED):
        raise ConflictError("NOT_ELIGIBLE", "You can't resign from this status." if emp.status != "NOTICE_PERIOD" else "You're already serving notice.")
    if Resignation.objects.filter(employee=emp, status__in=[*Resignation.OPEN, R.ACCEPTED]).exists():
        raise ConflictError("ALREADY_SUBMITTED", "You already have a resignation in progress.")
    if len(reason.strip()) < 10:
        raise BusinessRuleError("REASON_REQUIRED", "Add a short reason (at least 10 characters).", field_errors={"reason": ["Required."]})
    _check_dates(emp, proposed_last_day)
    t = today()
    r = Resignation.objects.create(organization=emp.organization, employee=emp, reason=reason.strip(), submitted_on=t, proposed_last_day=proposed_last_day,
                                   notice_days=notice_days(emp.organization), letter=resignation_letter(emp, reason, t, proposed_last_day), own_letter=own_letter)
    audit(actor=emp.user, action="RESIGNATION_SUBMITTED", entity=r, after={"proposed_last_day": str(proposed_last_day)}, request=request)
    for u in super_admins(emp.organization):
        queue_email(template_key="resignation", recipient=u.email, subject=f"Resignation: {emp.display_name}", body=r.letter, dedupe_key=f"resign:{r.pk}:{r.revision}:{u.pk}", organization=emp.organization)
    notify(list(super_admins(emp.organization)), f"Resignation: {emp.display_name}", f"Proposed last day {proposed_last_day:%d %b}", "/console/exits")
    notify(_hr(emp.organization), f"{emp.display_name} submitted a resignation", "Waiting for the Super Admin.", "/hr/exits")
    return r


@transaction.atomic
def revise(r: Resignation, emp: Employee, *, reason: str, proposed_last_day: date, request=None) -> Resignation:
    r = Resignation.objects.select_for_update().get(pk=r.pk)
    if r.employee_id != emp.pk:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if r.status not in (R.DISCUSSION_REQUESTED, R.NOTICE_REVISION_REQUESTED):
        raise ConflictError("NOT_REVISABLE", "You can change it only when the Super Admin asks.")
    if len(reason.strip()) < 10:
        raise BusinessRuleError("REASON_REQUIRED", "Add a short reason (at least 10 characters).")
    _check_dates(emp, proposed_last_day)
    r.history = [*r.history, {"revision": r.revision, "letter": r.letter, "proposed_last_day": str(r.proposed_last_day), "at": timezone.now().isoformat()}]
    r.revision += 1
    r.reason, r.proposed_last_day, r.status = reason.strip(), proposed_last_day, R.SUBMITTED
    r.letter = resignation_letter(emp, reason, r.submitted_on, proposed_last_day)
    r.save()
    audit(actor=emp.user, action="RESIGNATION_REVISED", entity=r, after={"revision": r.revision, "proposed_last_day": str(proposed_last_day)}, request=request)
    notify(list(super_admins(emp.organization)), f"Resignation updated: {emp.display_name}", f"Proposed last day {proposed_last_day:%d %b}", "/console/exits")
    return r


@transaction.atomic
def withdraw_resignation(r: Resignation, emp: Employee, request=None) -> Resignation:
    r = Resignation.objects.select_for_update().get(pk=r.pk)
    if r.employee_id != emp.pk:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if r.status not in Resignation.OPEN:
        raise ConflictError("NOT_WITHDRAWABLE", "An accepted resignation can only be reversed by the Super Admin.")
    r.status = R.WITHDRAWN
    r.save(update_fields=["status", "updated_at"])
    audit(actor=emp.user, action="RESIGNATION_WITHDRAWN", entity=r, request=request)
    notify(list(super_admins(emp.organization)) + _hr(emp.organization), f"{emp.display_name} withdrew their resignation", "", "/console/exits")
    return r


@transaction.atomic
def decide_resignation(r: Resignation, actor, decision: str, note: str, last_day: date | None = None, request=None) -> Resignation:
    r = Resignation.objects.select_for_update().get(pk=r.pk)
    if r.status != R.SUBMITTED:
        raise ConflictError("NOT_PENDING", "This resignation isn't waiting for a decision.")
    note = note.strip()
    emp = Employee.objects.select_for_update().get(pk=r.employee_id)
    if decision in ("DISCUSSION", "NOTICE_REVISION"):
        if len(note) < 3:
            raise BusinessRuleError("NOTE_REQUIRED", "Add a note for the employee.")
        r.status = R.DISCUSSION_REQUESTED if decision == "DISCUSSION" else R.NOTICE_REVISION_REQUESTED
        r.admin_note = note
        r.save(update_fields=["status", "admin_note", "updated_at"])
        audit(actor=actor, action=f"RESIGNATION_{r.status}", entity=r, reason=note, request=request)
        notify(emp.user, "About your resignation", note, "/app/resignation", tone="warning")
        return r
    if decision != "ACCEPT":
        raise BusinessRuleError("INVALID_DECISION", "Accept, ask to discuss, or ask to revise the notice.")
    last = last_day or r.proposed_last_day
    if last < today() or last < r.submitted_on:
        raise BusinessRuleError("LAST_DAY_PASSED", "The last working day can't be in the past.")
    if last < r.submitted_on + timedelta(days=r.notice_days) and len(note) < 5:
        raise BusinessRuleError("SHORT_NOTICE_REASON", f"That's shorter than the {r.notice_days}-day notice. Add the reason (for example, notice waived by mutual agreement).",
                                field_errors={"note": ["Required for short notice."]})
    r.status, r.accepted_last_day, r.admin_note, r.decided_by, r.decided_at = R.ACCEPTED, last, note, actor, timezone.now()
    r.save()
    emp.status = Employee.Status.NOTICE_PERIOD
    emp.save(update_fields=["status", "updated_at"])
    ex = ExitCase.objects.create(organization=emp.organization, employee=emp, resignation=r, last_working_day=last,
                                 checklist=[{"key": k, "label": lb, "done": False} for k, lb in EXIT_CHECKLIST])
    audit(actor=actor, action="RESIGNATION_ACCEPTED", entity=r, after={"last_working_day": str(last)}, reason=note, request=request)
    letters.draft(emp, "RESIGNATION_ACCEPTANCE", actor, source=f"exit:{ex.pk}",
                  ctx={"exit.resignation_date": f"{r.submitted_on:%d %B %Y}", "exit.last_working_date": f"{last:%d %B %Y}"}, request=request)
    notify(emp.user, "Your resignation was accepted", f"Last working day: {last:%d %b %Y}", "/app/resignation")
    notify(_hr(emp.organization), f"Exit started: {emp.display_name}", f"Last day {last:%d %b}. The acceptance letter draft is ready.", "/hr/exits")
    return r


# ---------- exit checklist ----------
def blockers(ex: ExitCase) -> list[str]:
    out = [i["label"] for i in ex.checklist if not i["done"]]
    n = open_assets(ex.employee).count()
    if n:
        out.append(f"{n} company asset{'s' if n > 1 else ''} not returned")
    return out


def set_exit_check(ex: ExitCase, actor, key: str, done: bool, request=None) -> ExitCase:
    if ex.status != ExitCase.Status.IN_PROGRESS:
        raise ConflictError("EXIT_CLOSED", "This exit is complete.")
    if key not in {k for k, _ in EXIT_CHECKLIST}:
        raise BusinessRuleError("INVALID_ITEM", "Unknown checklist item.")
    ex.checklist = [{**i, "done": done, "by": actor.display_name if done else "", "at": timezone.now().isoformat() if done else ""} if i["key"] == key else i for i in ex.checklist]
    ex.save(update_fields=["checklist"])
    audit(actor=actor, action="EXIT_CHECK", entity=ex.employee, after={"item": key, "done": done}, request=request)
    return ex


# ---------- full & final ----------
def money(x) -> Decimal:
    return Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def draft_settlement(ex: ExitCase) -> Settlement:
    """System lines: pro-rated salary for the final month (zero if that month is already in a payroll run), plus leave-encashment and recovery placeholders at ₹0 for the Super Admin to fill after review."""
    from leaves.services import balances
    from payroll.models import Payslip
    st = getattr(ex, "settlement", None) or Settlement(exit_case=ex)
    if st.status == Settlement.Status.APPROVED:
        return st
    emp, lwd = ex.employee, ex.last_working_day
    sv = emp.salary_versions.filter(effective_from__lte=lwd).order_by("-effective_from").first()
    first = date(lwd.year, lwd.month, 1)
    month_days = calendar.monthrange(lwd.year, lwd.month)[1]
    paid_days = (lwd - max(first, emp.start_date)).days + 1
    in_payroll = Payslip.objects.filter(employee=emp, run__year=lwd.year, run__month=lwd.month).exists()
    warnings = []
    lines = []
    if sv is None:
        warnings.append("No salary on record: add the final salary line by hand.")
    elif in_payroll:
        warnings.append(f"{lwd:%B %Y} is already in a payroll run, so the final month's salary is not repeated here.")
    else:
        ratio = Decimal(paid_days) / Decimal(month_days)
        for c in sv.components:
            if c["type"] == "EARNING":
                lines.append({"code": c["code"], "name": f"{c['name']} ({paid_days}/{month_days} days)", "type": "EARNING", "amount": str(money(Decimal(c["amount"]) * ratio)), "note": "", "system": True})
    el = balances(emp, lwd.year)["EL"]["available"]
    lines.append({"code": "LEAVE_ENCASH", "name": f"Leave encashment ({el} EL days available)", "type": "EARNING", "amount": "0.00", "note": "Check eligibility under the policy and law before adding.", "system": True})
    flagged = list(Allocation.objects.filter(employee=emp, admin_decision="RECOVERY_REVIEW").select_related("asset"))
    if flagged:
        lines.append({"code": "RECOVERY", "name": "Asset recovery (" + ", ".join(a.asset.tag for a in flagged) + ")", "type": "DEDUCTION", "amount": "0.00",
                      "note": "Only a lawful, agreed amount. Nothing is deducted automatically.", "system": True})
    keep = [x for x in st.lines if not x.get("system")]
    st.lines = lines + keep
    st.info = {"salary_version": str(sv.pk) if sv else None, "monthly_gross": str(sv.monthly_gross) if sv else None, "paid_days": paid_days, "month_days": month_days,
               "last_working_day": str(lwd), "el_available": float(el), "warnings": warnings}
    st.net = _net(st.lines)
    st.save()
    return st


def _net(lines) -> Decimal:
    return money(sum((Decimal(x["amount"]) * (1 if x["type"] == "EARNING" else -1) for x in lines), ZERO))


@transaction.atomic
def edit_settlement(ex: ExitCase, actor, lines: list[dict], request=None) -> Settlement:
    st = draft_settlement(ex)
    if st.status != Settlement.Status.DRAFT:
        raise ConflictError("FNF_APPROVED", "The settlement is approved and locked.")
    clean = []
    for x in lines:
        try:
            amt = money(x.get("amount", 0))
        except Exception:
            raise BusinessRuleError("INVALID_AMOUNT", "Amounts must be numbers.")
        if amt < 0 or x.get("type") not in ("EARNING", "DEDUCTION") or len(str(x.get("name", "")).strip()) < 2:
            raise BusinessRuleError("INVALID_LINE", "Each line needs a name, earning or deduction, and an amount of 0 or more.")
        system = bool(x.get("system")) and x.get("code") in {s.get("code") for s in st.lines if s.get("system")}
        if not system and len(str(x.get("note", "")).strip()) < 3:
            raise BusinessRuleError("NOTE_REQUIRED", f"Add a note for “{x['name']}”.")
        if x.get("code") == "RECOVERY" and amt > 0 and len(str(x.get("note", "")).strip()) < 10:
            raise BusinessRuleError("RECOVERY_REASON", "Explain the lawful basis and agreement for the recovery.")
        clean.append({"code": x.get("code") or "ADJ", "name": str(x["name"]).strip()[:120], "type": x["type"], "amount": str(amt), "note": str(x.get("note", "")).strip()[:300], "system": system})
    st.lines, st.net = clean, _net(clean)
    st.save()
    audit(actor=actor, action="FNF_EDITED", entity=ex.employee, after={"lines": len(clean)}, request=request)  # no amounts in the audit trail
    return st


@transaction.atomic
def approve_settlement(ex: ExitCase, actor, request=None) -> Settlement:
    ex = ExitCase.objects.select_for_update().get(pk=ex.pk)
    st = draft_settlement(ex)
    if st.status != Settlement.Status.DRAFT:
        raise ConflictError("FNF_APPROVED", "Already approved.")
    gaps = blockers(ex)
    if gaps:
        raise BusinessRuleError("EXIT_NOT_CLEARED", f"Clear these first: {', '.join(gaps)}.")
    if Allocation.objects.filter(employee=ex.employee, disputed=True, closed_at__isnull=True).exists():
        raise BusinessRuleError("ASSET_DISPUTE", "Decide the open asset dispute first.")
    if st.net < 0:
        raise BusinessRuleError("NEGATIVE_NET", "The settlement can't be below zero. Recoveries beyond what's payable need a separate agreement.")
    st.status, st.approved_by, st.approved_at = Settlement.Status.APPROVED, actor, timezone.now()
    st.digest = hashlib.sha256(json.dumps({"lines": st.lines, "net": str(st.net), "info": st.info}, sort_keys=True).encode()).hexdigest()
    st.save()
    audit(actor=actor, action="FNF_APPROVED", entity=ex.employee, after={"digest": st.digest}, request=request)
    emp, lwd = ex.employee, f"{ex.last_working_day:%d %B %Y}"
    lt = letters.draft(emp, "FNF_STATEMENT", actor, source=f"exit:{ex.pk}", ctx={"exit.last_working_date": lwd, "fnf_net": str(st.net)}, request=request)
    lt.status = letters.L.PENDING_ADMIN
    lt.save(update_fields=["status"])
    letters.release(lt, actor, request)  # the Super Admin's approval of the F&F is the approval of its statement
    for kind in ("EXPERIENCE", "RELIEVING"):
        if not emp.letters.filter(kind=kind).exclude(status="REJECTED").exists():
            letters.draft(emp, kind, actor, source=f"exit:{ex.pk}", ctx={"exit.last_working_date": lwd}, request=request)
    notify(_hr(emp.organization), f"F&F approved: {emp.display_name}", "Experience and relieving letter drafts are ready.", "/hr/letters")
    return st


@transaction.atomic
def complete_exit(ex: ExitCase, actor, request=None) -> ExitCase:
    """Access ends only now: on or after the last working day, with F&F approved and the relieving letter sent (BRD §11.2)."""
    ex = ExitCase.objects.select_for_update().get(pk=ex.pk)
    if ex.status == ExitCase.Status.COMPLETED:
        raise ConflictError("EXIT_CLOSED", "Already completed.")
    if today() < ex.last_working_day:
        raise BusinessRuleError("BEFORE_LAST_DAY", f"Access can't be revoked before the last working day ({ex.last_working_day:%d %b %Y}).")
    gaps = blockers(ex)
    st = getattr(ex, "settlement", None)
    if st is None or st.status != Settlement.Status.APPROVED:
        gaps.append("Full & final not approved")
    if not ex.employee.letters.filter(kind="RELIEVING", status="RELEASED").exists():
        gaps.append("Relieving letter not sent")
    if gaps:
        raise BusinessRuleError("EXIT_NOT_CLEARED", f"Still open: {', '.join(gaps)}.")
    emp = Employee.objects.select_for_update().get(pk=ex.employee_id)
    emp.status = Employee.Status.EXITED
    emp.save(update_fields=["status", "updated_at"])
    user = emp.user
    user.is_active = False
    user.save(update_fields=["is_active"])
    uid = str(user.pk)
    for s in Session.objects.filter(expire_date__gt=timezone.now()):
        if s.get_decoded().get("_auth_user_id") == uid:
            s.delete()
    ex.status, ex.completed_by, ex.completed_at = ExitCase.Status.COMPLETED, actor, timezone.now()
    ex.save()
    audit(actor=actor, action="EXIT_COMPLETED", entity=emp, after={"last_working_day": str(ex.last_working_day)}, request=request)
    return ex
