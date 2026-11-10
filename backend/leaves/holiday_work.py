"""Holiday Work (remote only) and Comp-Off (BRD §7). Hours alone never award comp-off: the Super Admin reviews and credits,
and only while the exchange rule is marked legally reviewed in policy `compoff.rule`."""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from attendance.services import is_workday, policy
from common.errors import BusinessRuleError, ConflictError
from common.models import PolicyVersion
from common.services import audit, notify, queue_email
from employees.models import Employee

from .models import CompOffLedger, HolidayWork, LeaveRequest
from .services import _lock, _notify_admins, employee_holidays, leave_on, today

H = HolidayWork.Status
K = CompOffLedger.Kind
ZERO = Decimal("0")
HALF = Decimal("0.5")
RULE_KEY = "compoff.rule"
RULE_DEFAULT = {"active": False, "full_day_hours": 8, "half_day_hours": 4, "expiry_days": 90, "review_note": ""}
AHEAD_DAYS = 60


# ---------- rule ----------
def rule(org) -> dict:
    return {**RULE_DEFAULT, **policy(org, RULE_KEY, {})}


def rule_row(org) -> PolicyVersion | None:
    return PolicyVersion.objects.filter(organization=org, key=RULE_KEY, effective_from__lte=timezone.localdate()).order_by("-effective_from").first()


@transaction.atomic
def set_rule(org, actor, *, active: bool, full_day_hours, half_day_hours, expiry_days: int, review_note: str, request=None) -> dict:
    full, half, note = Decimal(str(full_day_hours)), Decimal(str(half_day_hours)), review_note.strip()
    if not (Decimal("1") <= half < full <= Decimal("12")):
        raise BusinessRuleError("INVALID_RULE", "Half-day hours must be at least 1 and below full-day hours; full day at most 12.")
    if not (30 <= expiry_days <= 365):
        raise BusinessRuleError("INVALID_RULE", "Comp-off must expire between 30 and 365 days after the work day.")
    if active and len(note) < 10:
        raise BusinessRuleError("REVIEW_NOTE_REQUIRED", "Say who reviewed the rule legally and when before switching it on.", field_errors={"review_note": ["Required to activate."]})
    before = rule(org)
    value = {"active": active, "full_day_hours": float(full), "half_day_hours": float(half), "expiry_days": expiry_days, "review_note": note}
    PolicyVersion.objects.update_or_create(organization=org, key=RULE_KEY, effective_from=timezone.localdate(), defaults={
        "value": value, "created_by": actor, "status": PolicyVersion.Status.APPROVED if active else PolicyVersion.Status.REQUIRES_LEGAL_REVIEW})
    audit(actor=actor, action="COMPOFF_RULE_CHANGED", entity=rule_row(org), before=before, after=value, request=request, organization=org)
    return value


def units_for(org, hours: Decimal) -> Decimal:
    r = rule(org)
    return Decimal("1") if hours >= Decimal(str(r["full_day_hours"])) else HALF if hours >= Decimal(str(r["half_day_hours"])) else ZERO


# ---------- eligibility ----------
def day_label(employee: Employee, d) -> str | None:
    """Why `d` is eligible for holiday work, or None if it is a normal working day for this person."""
    hol = employee_holidays(employee, d, d).get(d)
    if hol:
        return hol
    if not is_workday(employee.organization, d):
        return f"Weekly off ({d:%A})"
    return None


def eligible_dates(employee: Employee) -> list[dict]:
    t = today()
    taken = set(HolidayWork.objects.filter(employee=employee, work_date__gte=t).exclude(status__in=HolidayWork.CLOSED).values_list("work_date", flat=True))
    out = []
    for i in range(AHEAD_DAYS + 1):
        d = t + timedelta(days=i)
        label = day_label(employee, d)
        if label and d not in taken:
            out.append({"date": d, "label": label})
    return out


# ---------- employee ----------
@transaction.atomic
def request_work(employee: Employee, actor, *, work_date, title: str, purpose: str, expected_hours, emergency: bool, request=None) -> HolidayWork:
    employee = _lock(employee)
    t = today()
    title, purpose, hours = title.strip(), purpose.strip(), Decimal(str(expected_hours))
    if len(title) < 3:
        raise BusinessRuleError("TITLE_REQUIRED", "Name the project or task.", field_errors={"title": ["Required."]})
    if len(purpose) < 10:
        raise BusinessRuleError("PURPOSE_REQUIRED", "Explain why this can't wait for a working day (at least 10 characters).", field_errors={"purpose": ["Required."]})
    if not (Decimal("1") <= hours <= Decimal("12")):
        raise BusinessRuleError("INVALID_HOURS", "Expected hours must be between 1 and 12.", field_errors={"expected_hours": ["1 to 12."]})
    if emergency and work_date != t:
        raise BusinessRuleError("EMERGENCY_TODAY_ONLY", "An emergency request is only for today. Plan other dates as a normal request.")
    if work_date < t:
        raise BusinessRuleError("DATE_PASSED", "Holiday work needs approval before the day. For today, use an emergency request.")
    if work_date > t + timedelta(days=AHEAD_DAYS):
        raise BusinessRuleError("TOO_FAR_AHEAD", f"Request holiday work up to {AHEAD_DAYS} days ahead.")
    if work_date < employee.start_date:
        raise BusinessRuleError("BEFORE_JOINING", "That's before your joining date.")
    label = day_label(employee, work_date)
    if label is None:
        raise BusinessRuleError("NOT_A_HOLIDAY", "That's a normal working day. Holiday work is only for weekly offs and your holidays.")
    lv = leave_on(employee, work_date)
    if lv and not lv.half_day:
        raise ConflictError("ON_LEAVE", "You're on approved leave that day.")
    if HolidayWork.objects.filter(employee=employee, work_date=work_date).exclude(status__in=HolidayWork.CLOSED).exists():
        raise ConflictError("ALREADY_REQUESTED", f"You already have holiday work for {work_date:%d %b}.")
    hw = HolidayWork.objects.create(organization=employee.organization, employee=employee, work_date=work_date, day_label=label, title=title,
                                    purpose=purpose, expected_hours=hours, emergency=emergency, status=H.EMERGENCY if emergency else H.REQUESTED)
    audit(actor=actor, action="HOLIDAY_WORK_EMERGENCY" if emergency else "HOLIDAY_WORK_REQUESTED", entity=hw,
          after={"date": str(work_date), "hours": str(hours), "title": title}, request=request)
    what = "started emergency holiday work" if emergency else "requested holiday work"
    _notify_admins(employee.organization, f"Holiday work: {employee.display_name}",
                   f"{employee.display_name} {what} on {work_date:%d %b} ({label}): {title}. Review it in Antro HRMS → Console → Holiday Work.",
                   f"hw-request:{hw.pk}", "/console/holiday-work")
    return hw


def _get_locked(hw: HolidayWork) -> HolidayWork:
    _lock(hw.employee)
    return HolidayWork.objects.select_for_update().get(pk=hw.pk)


@transaction.atomic
def start(hw: HolidayWork, actor, request=None) -> HolidayWork:
    """Start or resume. Remote only: no office geofence (BRD §7.1)."""
    hw = _get_locked(hw)
    if hw.status == H.REQUESTED:
        raise BusinessRuleError("NOT_APPROVED", "Wait for the Super Admin to approve this first.")
    if hw.status not in (H.APPROVED, H.EMERGENCY):
        raise ConflictError("NOT_STARTABLE", "This holiday work is closed.")
    if hw.work_date != today():
        raise BusinessRuleError("NOT_TODAY", f"You can only work on {hw.work_date:%d %b}.")
    if hw.running:
        return hw
    hw.intervals = [*hw.intervals, [timezone.now().isoformat(), None]]
    hw.save(update_fields=["intervals", "updated_at"])
    audit(actor=actor, action="HOLIDAY_WORK_STARTED" if len(hw.intervals) == 1 else "HOLIDAY_WORK_RESUMED", entity=hw, request=request)
    return hw


def _close(hw: HolidayWork) -> None:
    """End the running interval, never past the end of the work day (a forgotten Stop can't add overnight hours)."""
    if not hw.running:
        return
    day_end = timezone.make_aware(datetime.combine(hw.work_date + timedelta(days=1), time.min))
    started = datetime.fromisoformat(hw.intervals[-1][0])
    hw.intervals[-1][1] = max(started, min(timezone.now(), day_end)).isoformat()  # never negative


def _seconds(hw: HolidayWork) -> int:
    return int(sum((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() for a, b in hw.intervals if b))


@transaction.atomic
def pause(hw: HolidayWork, actor, request=None) -> HolidayWork:
    hw = _get_locked(hw)
    if not hw.running:
        raise ConflictError("NOT_RUNNING", "You're not working right now.")
    _close(hw)
    hw.worked_seconds = _seconds(hw)
    hw.save(update_fields=["intervals", "worked_seconds", "updated_at"])
    audit(actor=actor, action="HOLIDAY_WORK_PAUSED", entity=hw, request=request)
    return hw


@transaction.atomic
def stop(hw: HolidayWork, actor, *, summary: str, task_refs: str = "", request=None) -> HolidayWork:
    hw = _get_locked(hw)
    if hw.status not in (H.APPROVED, H.EMERGENCY) or not hw.intervals:
        raise ConflictError("NOT_STARTED", "Start work before ending it.")
    summary = summary.strip()
    if len(summary) < 10:
        raise BusinessRuleError("SUMMARY_REQUIRED", "Describe what you did (at least 10 characters). The Super Admin reviews it.", field_errors={"summary": ["Required."]})
    _close(hw)
    hw.worked_seconds, hw.summary, hw.task_refs, hw.status = _seconds(hw), summary, task_refs.strip()[:500], H.AWAITING_REVIEW
    hw.save()
    audit(actor=actor, action="HOLIDAY_WORK_ENDED", entity=hw, after={"worked_seconds": hw.worked_seconds}, request=request)
    _notify_admins(hw.organization, f"Holiday work to verify: {hw.employee.display_name}",
                   f"{hw.employee.display_name} finished {hw.worked_seconds / 3600:.1f} h of holiday work on {hw.work_date:%d %b}. Verify it in Antro HRMS → Console → Holiday Work.",
                   f"hw-stop:{hw.pk}", "/console/holiday-work")
    return hw


@transaction.atomic
def cancel(hw: HolidayWork, actor, request=None) -> HolidayWork:
    hw = _get_locked(hw)
    if hw.status not in (H.REQUESTED, H.APPROVED, H.EMERGENCY) or hw.intervals:
        raise ConflictError("NOT_CANCELLABLE", "Work has started or the request is closed, so it can't be cancelled.")
    hw.status = H.CANCELLED
    hw.save(update_fields=["status", "updated_at"])
    audit(actor=actor, action="HOLIDAY_WORK_CANCELLED", entity=hw, request=request)
    return hw


# ---------- Super Admin ----------
def _tell(hw: HolidayWork, title: str, body: str, tone: str):
    notify(hw.employee.user, title, body, "/app/holiday-work", tone=tone)
    queue_email(template_key="holiday_work", recipient=hw.employee.official_email, subject=title, body=title + "." + (f"\nNote: {body}" if body else ""),
                dedupe_key=f"hw:{hw.pk}:{hw.status}", organization=hw.organization)


@transaction.atomic
def decide(hw: HolidayWork, actor, decision: str, note: str = "", hours=None, request=None) -> HolidayWork:
    """APPROVE / REJECT a request before the day; CREDIT / NO_CREDIT after the work is ended. A credit posts the ledger exactly once."""
    hw = _get_locked(hw)
    note = note.strip()
    if decision in ("REJECT", "NO_CREDIT") and len(note) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Add a note for the employee.", field_errors={"note": ["Required."]})
    if decision in ("APPROVE", "REJECT"):
        if hw.status not in (H.REQUESTED, H.APPROVED, H.EMERGENCY) or (decision == "APPROVE" and hw.status != H.REQUESTED):
            raise ConflictError("ALREADY_DECIDED", "This request has already been decided or changed.")
        if decision == "APPROVE" and hw.work_date < today():
            raise BusinessRuleError("DATE_PASSED", "That day has passed. Reject it with a note instead.")
        _close(hw)
        hw.worked_seconds = _seconds(hw)
        hw.status = H.APPROVED if decision == "APPROVE" else H.REJECTED
        hw.decision_note, hw.decided_by, hw.decided_at = note, actor, timezone.now()
        hw.save()
        audit(actor=actor, action=f"HOLIDAY_WORK_{hw.status}", entity=hw, reason=note, request=request)
        _tell(hw, f"Holiday work on {hw.work_date:%d %b} was {'approved' if decision == 'APPROVE' else 'rejected'}", note,
              "success" if decision == "APPROVE" else "warning")
        return hw
    if decision not in ("CREDIT", "NO_CREDIT"):
        raise BusinessRuleError("INVALID_DECISION", "Unknown decision.")
    if hw.status != H.AWAITING_REVIEW:
        raise ConflictError("NOT_AWAITING_REVIEW", "Only ended holiday work can be verified." if hw.status in (H.APPROVED, H.EMERGENCY) else "This was already verified.")
    if decision == "CREDIT":
        r = rule(hw.organization)
        if not r["active"]:
            raise BusinessRuleError("LEGAL_RULE_INACTIVE", "The comp-off rate isn't switched on yet. Confirm its legal review in Comp-Off rule first.")
        try:
            h = Decimal(str(hours)).quantize(Decimal("0.1"))
        except Exception:
            raise BusinessRuleError("INVALID_HOURS", "Enter the verified hours.", field_errors={"hours": ["Required."]})
        worked = (Decimal(hw.worked_seconds) / 3600).quantize(Decimal("0.1"))
        if not (ZERO < h <= worked):
            raise BusinessRuleError("INVALID_HOURS", f"Verified hours must be more than 0 and at most the {worked} h recorded.", field_errors={"hours": [f"Up to {worked}."]})
        units = units_for(hw.organization, h)
        if units == 0:
            raise BusinessRuleError("UNDER_MINIMUM", f"Under {r['half_day_hours']} h earns no comp-off. Choose “No comp-off” with a note.")
        CompOffLedger.objects.create(organization=hw.organization, employee=hw.employee, kind=K.GRANT, units=units, holiday_work=hw, hours=h,
                                     expires_on=hw.work_date + timedelta(days=int(r["expiry_days"])), created_by=actor,
                                     rule={**r, "policy_id": str(getattr(rule_row(hw.organization), "pk", "")) or None})
        hw.approved_hours, hw.units, hw.status = h, units, H.CREDITED
    else:
        hw.status = H.NOT_CREDITED
    hw.review_note, hw.reviewed_by, hw.reviewed_at = note, actor, timezone.now()
    hw.save()
    audit(actor=actor, action=f"HOLIDAY_WORK_{hw.status}", entity=hw, after={"hours": str(hw.approved_hours), "units": str(hw.units)}, reason=note, request=request)
    if hw.status == H.CREDITED:
        _tell(hw, f"{'1 day' if hw.units == 1 else 'Half a day'} of comp-off credited for {hw.work_date:%d %b}", note, "success")
    else:
        _tell(hw, f"No comp-off for holiday work on {hw.work_date:%d %b}", note, "warning")
    return hw


# ---------- balance and usage (as leave category CO) ----------
def _grants(employee: Employee, valid_on=None):
    """Grants with what's left on each, earliest expiry first."""
    out = []
    for g in CompOffLedger.objects.filter(employee=employee, kind=K.GRANT).order_by("expires_on", "created_at"):
        left = g.units + (g.draws.aggregate(s=Sum("units"))["s"] or ZERO)
        out.append((g, left, valid_on is None or g.expires_on >= valid_on))
    return out


def balance(employee: Employee) -> dict:
    t = today()
    gs = _grants(employee)
    granted = sum((g.units for g, _, _ in gs), ZERO)
    live = sum((left for g, left, _ in gs if g.expires_on >= t), ZERO)
    expired = sum((left for g, left, _ in gs if g.expires_on < t), ZERO)
    pending = LeaveRequest.objects.filter(employee=employee, category="CO", status__in=LeaveRequest.HOLDING).aggregate(s=Sum("days"))["s"] or ZERO
    return {"granted": granted, "used": granted - live - expired, "pending": pending, "available": live - pending, "expired": expired,
            "next_expiry": next((g.expires_on for g, left, _ in gs if left > 0 and g.expires_on >= t), None)}


def available_on(employee: Employee, d, exclude_pending=None) -> Decimal:
    usable = sum((left for g, left, ok in _grants(employee, d) if ok), ZERO)
    pending = LeaveRequest.objects.filter(employee=employee, category="CO", status__in=LeaveRequest.HOLDING).exclude(pk=exclude_pending).aggregate(s=Sum("days"))["s"] or ZERO
    return usable - pending


def consume(r: LeaveRequest, actor) -> None:
    """Draw approved CO leave from grants still valid on the leave's last day, earliest expiry first."""
    need = r.days
    for g, left, ok in _grants(r.employee, r.end):
        if need <= 0:
            break
        if ok and left > 0:
            take = min(left, need)
            CompOffLedger.objects.create(organization=r.organization, employee=r.employee, kind=K.USE, units=-take, grant=g, leave=r, created_by=actor)
            need -= take
    if need > 0:
        raise BusinessRuleError("INSUFFICIENT_BALANCE", "Not enough comp-off valid on those dates.")


def restore(r: LeaveRequest, actor) -> None:
    for u in CompOffLedger.objects.filter(leave=r, kind=K.USE):
        CompOffLedger.objects.create(organization=r.organization, employee=r.employee, kind=K.RESTORE, units=-u.units, grant=u.grant, leave=r, created_by=actor)
