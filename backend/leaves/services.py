"""Holiday calendar, optional holidays and CL/SL/EL leave rules (BRD §5, §6). Server is authoritative."""
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import User
from attendance.services import WEEKDAYS, policy
from common.errors import BusinessRuleError, ConflictError
from common.services import audit, notify, queue_email, super_admins
from employees.models import Employee

from .models import Category, Holiday, HolidayCalendar, LeaveLedger, LeaveRequest, OptionalHolidayChoice

S = HolidayCalendar.Status
L = LeaveRequest.Status
CATS = ["CL", "SL", "EL"]  # annual-grant categories; CO (Comp-Off) is backed by CompOffLedger
ZERO = Decimal("0")


def today() -> date:
    return timezone.localdate()


def _lock(employee: Employee) -> Employee:
    return Employee.objects.select_for_update().get(pk=employee.pk)


def _notify_admins(org, subject: str, body: str, key: str, link: str = "/console/approvals"):
    admins = list(super_admins(org))
    for u in admins:
        queue_email(template_key="leave", recipient=u.email, subject=subject, body=body, dedupe_key=f"{key}:{u.pk}", organization=org)
    notify(admins, subject, body.split(". ")[0][:300], link)


# ---------- holiday calendar ----------
def optional_rules(org) -> dict:
    return policy(org, "holidays.optional", {"published": 4, "per_employee": 2})


def published(org, year: int) -> HolidayCalendar | None:
    return HolidayCalendar.objects.filter(organization=org, year=year, status=S.PUBLISHED).first()


def published_holidays(org, start: date, end: date) -> list[Holiday]:
    return list(Holiday.objects.filter(calendar__organization=org, calendar__status=S.PUBLISHED, date__range=(start, end)))


def employee_holidays(employee: Employee, start: date, end: date) -> dict[date, str]:
    """Fixed holidays plus the optional ones this person chose. Unchosen optional days stay workdays (BRD §5.3)."""
    out, optional = {}, {}
    for h in published_holidays(employee.organization, start, end):
        (out if h.kind == Holiday.Kind.FIXED else optional)[h.date] = h.name
    for d in employee.holiday_choices.filter(date__range=(start, end)).values_list("date", flat=True):
        if d in optional:
            out[d] = optional[d]
    return out


def working_days(employee: Employee, start: date, end: date) -> list[date]:
    week = policy(employee.organization, "attendance.workdays", ["MON", "TUE", "WED", "THU", "FRI"])
    off = employee_holidays(employee, start, end)
    days, d = [], start
    while d <= end:
        if WEEKDAYS[d.weekday()] in week and d not in off:
            days.append(d)
        d += timedelta(days=1)
    return days


def open_draft(org, year: int, actor) -> HolidayCalendar:
    """The year's editable draft; a new one starts as a copy of the published revision."""
    draft = HolidayCalendar.objects.filter(organization=org, year=year, status__in=[S.DRAFT, S.SUBMITTED]).first()
    if draft:
        return draft
    last = HolidayCalendar.objects.filter(organization=org, year=year).order_by("-revision").first()
    draft = HolidayCalendar.objects.create(organization=org, year=year, revision=(last.revision + 1) if last else 1, created_by=actor)
    base = published(org, year)
    if base:
        Holiday.objects.bulk_create([Holiday(calendar=draft, date=h.date, name=h.name, kind=h.kind) for h in base.holidays.all()])
    return draft


@transaction.atomic
def save_draft(cal: HolidayCalendar, holidays: list[dict], note: str, actor, request=None) -> HolidayCalendar:
    if cal.status != S.DRAFT:
        raise ConflictError("NOT_A_DRAFT", "Only a draft can be edited. Ask the Super Admin to send it back, or start a new revision.")
    dates = [h["date"] for h in holidays]
    errors = {}
    if len(dates) != len(set(dates)):
        errors["holidays"] = ["Two holidays share the same date."]
    if any(d.year != cal.year for d in dates):
        errors["holidays"] = [f"Every date must be in {cal.year}."]
    if sum(h["kind"] == Holiday.Kind.OPTIONAL for h in holidays) > optional_rules(cal.organization)["published"]:
        errors["holidays"] = [f"At most {optional_rules(cal.organization)['published']} optional holidays."]
    if errors:
        raise BusinessRuleError("INVALID_CALENDAR", next(iter(errors.values()))[0], field_errors=errors)
    cal.holidays.all().delete()
    Holiday.objects.bulk_create([Holiday(calendar=cal, date=h["date"], name=h["name"].strip(), kind=h["kind"]) for h in holidays])
    cal.note = note
    cal.save(update_fields=["note"])
    audit(actor=actor, action="HOLIDAY_DRAFT_SAVED", entity=cal, after={"year": cal.year, "revision": cal.revision, "count": len(holidays)}, request=request)
    return cal


@transaction.atomic
def submit_draft(cal: HolidayCalendar, actor, request=None) -> HolidayCalendar:
    if cal.status != S.DRAFT:
        raise ConflictError("NOT_A_DRAFT", "This calendar was already sent for approval.")
    need = optional_rules(cal.organization)["published"]
    have = cal.holidays.filter(kind=Holiday.Kind.OPTIONAL).count()
    if have != need:
        raise BusinessRuleError("OPTIONAL_COUNT", f"Publish exactly {need} optional holidays (this draft has {have}).")
    if not cal.holidays.filter(kind=Holiday.Kind.FIXED).exists():
        raise BusinessRuleError("NO_FIXED_HOLIDAYS", "Add the fixed holidays before sending for approval.")
    cal.status = S.SUBMITTED
    cal.save(update_fields=["status"])
    audit(actor=actor, action="HOLIDAY_DRAFT_SUBMITTED", entity=cal, after={"year": cal.year, "revision": cal.revision}, request=request)
    _notify_admins(cal.organization, f"Holiday calendar {cal.year} needs approval", f"Revision {cal.revision} of the {cal.year} holiday calendar is waiting for your approval in Antro HRMS.", f"cal-submit:{cal.pk}", "/hr/holidays")
    return cal


@transaction.atomic
def decide_calendar(cal: HolidayCalendar, actor, approve: bool, note: str, request=None) -> HolidayCalendar:
    if cal.status != S.SUBMITTED:
        raise ConflictError("NOT_SUBMITTED", "Only a calendar sent for approval can be decided.")
    if not approve and len(note.strip()) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Say what needs to change.", field_errors={"note": ["Required when sending back."]})
    if approve:
        HolidayCalendar.objects.filter(organization=cal.organization, year=cal.year, status=S.PUBLISHED).update(status=S.SUPERSEDED)
    cal.status = S.PUBLISHED if approve else S.DRAFT
    cal.decision_note, cal.decided_by, cal.decided_at = note.strip(), actor, timezone.now()
    cal.save(update_fields=["status", "decision_note", "decided_by", "decided_at"])
    audit(actor=actor, action="HOLIDAY_CALENDAR_PUBLISHED" if approve else "HOLIDAY_CALENDAR_SENT_BACK", entity=cal, after={"year": cal.year, "revision": cal.revision}, reason=note, request=request)
    if approve:
        notify(User.objects.filter(organization=cal.organization, is_active=True), f"Holiday calendar {cal.year} is out", "Have a look and pick your optional holidays.", "/app/holidays", tone="success")
    else:
        notify(cal.created_by, f"Holiday calendar {cal.year} sent back", note.strip(), "/hr/holidays", tone="warning")
    return cal


def calendar_diff(cal: HolidayCalendar) -> list[dict]:
    """What this draft changes against the published revision (shown to the approver before publishing)."""
    base = published(cal.organization, cal.year)
    old = {h.date: h for h in base.holidays.all()} if base and base.pk != cal.pk else {}
    new = {h.date: h for h in cal.holidays.all()}
    out = [{"date": d, "change": "ADDED", "name": h.name, "kind": h.kind} for d, h in new.items() if d not in old]
    out += [{"date": d, "change": "REMOVED", "name": h.name, "kind": h.kind} for d, h in old.items() if d not in new]
    out += [{"date": d, "change": "CHANGED", "name": h.name, "kind": h.kind} for d, h in new.items() if d in old and (old[d].name, old[d].kind) != (h.name, h.kind)]
    return sorted(out, key=lambda x: x["date"])


@transaction.atomic
def choose_optional(employee: Employee, d: date, actor, request=None) -> OptionalHolidayChoice:
    employee = _lock(employee)
    h = Holiday.objects.filter(calendar__organization=employee.organization, calendar__status=S.PUBLISHED, date=d, kind=Holiday.Kind.OPTIONAL).first()
    if h is None:
        raise BusinessRuleError("NOT_AN_OPTIONAL_HOLIDAY", "That date isn't one of the published optional holidays.")
    if d <= today():
        raise BusinessRuleError("HOLIDAY_PASSED", "You can choose an optional holiday only before it arrives.")
    if employee.holiday_choices.filter(date=d).exists():
        raise ConflictError("ALREADY_CHOSEN", "You've already chosen this holiday.")
    limit = optional_rules(employee.organization)["per_employee"]
    offered = set(Holiday.objects.filter(calendar__organization=employee.organization, calendar__status=S.PUBLISHED, calendar__year=d.year, kind=Holiday.Kind.OPTIONAL).values_list("date", flat=True))
    if employee.holiday_choices.filter(date__year=d.year, date__in=offered).count() >= limit:
        raise BusinessRuleError("OPTIONAL_LIMIT", f"You can choose {limit} optional holidays a year. Remove one first (only before its date).")
    c = OptionalHolidayChoice.objects.create(organization=employee.organization, employee=employee, date=d, name=h.name)
    audit(actor=actor, action="OPTIONAL_HOLIDAY_CHOSEN", entity=c, after={"date": str(d)}, request=request)
    return c


@transaction.atomic
def unchoose_optional(employee: Employee, d: date, actor, request=None) -> None:
    c = employee.holiday_choices.filter(date=d).first()
    if c is None:
        raise BusinessRuleError("NOT_CHOSEN", "You haven't chosen this holiday.")
    if d <= today():
        raise BusinessRuleError("HOLIDAY_PASSED", "A holiday that has started or passed can't be changed. Ask the Super Admin for a correction.")
    audit(actor=actor, action="OPTIONAL_HOLIDAY_REMOVED", entity=c, before={"date": str(d)}, request=request)
    c.delete()


# ---------- leave balances ----------
def _half(x: Decimal) -> Decimal:
    return (x * 2).quantize(Decimal("1"), rounding=ROUND_HALF_UP) / 2


def ensure_grants(employee: Employee, year: int) -> None:
    """Annual grant per category, pro-rated by joining month in the joining year (policy leave.quotas)."""
    quotas = policy(employee.organization, "leave.quotas", {"CL": 12, "SL": 12, "EL": 15})
    have = set(LeaveLedger.objects.filter(employee=employee, year=year, source=LeaveLedger.Source.GRANT).values_list("category", flat=True))
    for cat in CATS:
        if cat in have:
            continue
        q = Decimal(str(quotas.get(cat, 0)))
        start = employee.start_date
        amount = ZERO if start.year > year else q if start.year < year else _half(q * (13 - start.month) / 12)
        LeaveLedger.objects.get_or_create(employee=employee, category=cat, year=year, source=LeaveLedger.Source.GRANT,
                                          defaults={"organization": employee.organization, "days": amount, "note": "Annual grant"})


def balances(employee: Employee, year: int) -> dict:
    ensure_grants(employee, year)
    led = LeaveLedger.objects.filter(employee=employee, year=year)
    reqs = LeaveRequest.objects.filter(employee=employee, start__year=year)
    out = {}
    for cat in CATS:
        rows = led.filter(category=cat)
        granted = rows.filter(source__in=["GRANT", "ADJUSTMENT"]).aggregate(s=Sum("days"))["s"] or ZERO
        used = -(rows.filter(source__in=["LEAVE", "CANCEL"]).aggregate(s=Sum("days"))["s"] or ZERO)
        pending = reqs.filter(category=cat, status__in=LeaveRequest.HOLDING).aggregate(s=Sum("days"))["s"] or ZERO
        out[cat] = {"granted": granted, "used": used, "pending": pending, "available": granted - used - pending}
    from .holiday_work import balance
    out["CO"] = balance(employee)
    return out


# ---------- leave requests ----------
def leave_on(employee: Employee, d: date) -> LeaveRequest | None:
    return LeaveRequest.objects.filter(employee=employee, status=L.APPROVED, start__lte=d, end__gte=d).first()


def _payroll_locked(org, d: date) -> bool:
    from payroll.services import is_locked  # payroll reads leave; import lazily to avoid a cycle
    return is_locked(org, d.year, d.month)


def _validate(employee: Employee, category: str, start: date, end: date, half_day: bool, exclude=None) -> Decimal:
    t = today()
    if category not in CATS and category != "CO":
        raise BusinessRuleError("INVALID_CATEGORY", "Choose Casual, Sick, Earned Leave or Comp-Off.")
    if end < start:
        raise BusinessRuleError("END_BEFORE_START", "The end date is before the start date.", field_errors={"end": ["Must be on or after the start date."]})
    if start.year != end.year:
        raise BusinessRuleError("CROSSES_YEAR", "Split leave that crosses 31 December into two requests.")
    if half_day and start != end:
        raise BusinessRuleError("HALF_DAY_ONE_DATE", "A half day is for a single date.")
    back = int(policy(employee.organization, "leave.backdate_days", 30))
    if start < t - timedelta(days=back):
        raise BusinessRuleError("TOO_FAR_BACK", f"Leave can be requested up to {back} days back. Ask the Super Admin for older dates.")
    if end > t + timedelta(days=365):
        raise BusinessRuleError("TOO_FAR_AHEAD", "Leave can be requested up to a year ahead.")
    if start < employee.start_date:
        raise BusinessRuleError("BEFORE_JOINING", "That's before your joining date.")
    days = working_days(employee, start, end)
    if not days:
        raise BusinessRuleError("NO_WORKING_DAYS", "Those dates are all weekends or holidays, so no leave is needed.")
    n = Decimal("0.5") if half_day else Decimal(len(days))
    clash = LeaveRequest.objects.filter(employee=employee, status__in=LeaveRequest.ACTIVE, start__lte=end, end__gte=start).exclude(pk=exclude)
    if clash.exists():
        c = clash.first()
        raise ConflictError("LEAVE_OVERLAP", f"You already have {c.get_category_display()} from {c.start:%d %b} to {c.end:%d %b} ({c.get_status_display().lower()}).")
    if not half_day:
        from attendance.models import AttendanceDay
        worked = AttendanceDay.objects.filter(employee=employee, work_date__in=days).order_by("work_date").first()
        if worked:
            raise ConflictError("ATTENDED_THAT_DAY", f"You checked in on {worked.work_date:%d %b}. Take a half day or leave that date out.")
    if category == "CO":
        from .holiday_work import available_on
        left = available_on(employee, end, exclude_pending=exclude)
        if n > left:
            raise BusinessRuleError("INSUFFICIENT_BALANCE", f"You have {left} comp-off day(s) valid on those dates and this needs {n}.")
        return n
    bal = balances(employee, start.year)[category]
    if n > bal["available"]:
        raise BusinessRuleError("INSUFFICIENT_BALANCE", f"You have {bal['available']} {category} day(s) available and this needs {n}.")
    return n


@transaction.atomic
def apply(employee: Employee, actor, *, category: str, start: date, end: date, half_day: bool, reason: str, request=None) -> LeaveRequest:
    employee = _lock(employee)
    reason = reason.strip()
    if len(reason) < 3:
        raise BusinessRuleError("REASON_REQUIRED", "Add a short reason for the approver.", field_errors={"reason": ["Required."]})
    n = _validate(employee, category, start, end, half_day)
    r = LeaveRequest.objects.create(organization=employee.organization, employee=employee, category=category, start=start, end=end, half_day=half_day, days=n, reason=reason)
    audit(actor=actor, action="LEAVE_SUBMITTED", entity=r, after={"category": category, "start": str(start), "end": str(end), "days": str(n)}, request=request)
    _notify_admins(employee.organization, f"Leave request: {employee.display_name}",
                   f"{employee.display_name} requested {n} day(s) of {r.get_category_display()} ({start:%d %b}–{end:%d %b}). Review it in Antro HRMS → Console → Leave.", f"leave-submit:{r.pk}")
    return r


@transaction.atomic
def resubmit(r: LeaveRequest, actor, *, category: str, start: date, end: date, half_day: bool, reason: str, request=None) -> LeaveRequest:
    _lock(r.employee)
    r = LeaveRequest.objects.select_for_update().get(pk=r.pk)
    if r.status != L.NEEDS_CHANGES:
        raise ConflictError("NOT_EDITABLE", "Only a request sent back for changes can be edited.")
    if len(reason.strip()) < 3:
        raise BusinessRuleError("REASON_REQUIRED", "Add a short reason for the approver.")
    r.days = _validate(r.employee, category, start, end, half_day, exclude=r.pk)
    r.category, r.start, r.end, r.half_day, r.reason, r.status = category, start, end, half_day, reason.strip(), L.SUBMITTED
    r.save()
    audit(actor=actor, action="LEAVE_RESUBMITTED", entity=r, after={"start": str(start), "end": str(end), "days": str(r.days)}, request=request)
    return r


@transaction.atomic
def cancel(r: LeaveRequest, actor, request=None) -> LeaveRequest:
    r = LeaveRequest.objects.select_for_update().get(pk=r.pk)
    if r.status in (L.SUBMITTED, L.NEEDS_CHANGES):
        pass
    elif r.status == L.APPROVED:
        if r.start <= today():
            raise BusinessRuleError("LEAVE_STARTED", "Approved leave that has started can't be cancelled here. Ask the Super Admin.")
        if _payroll_locked(r.organization, r.start):
            raise BusinessRuleError("PAYROLL_LOCKED", "Payroll for that month is already approved. Ask the Super Admin for an adjustment.")
        if r.category == "CO":
            from .holiday_work import restore
            restore(r, actor)
        else:
            LeaveLedger.objects.create(organization=r.organization, employee=r.employee, category=r.category, year=r.start.year, days=r.days,
                                       source=LeaveLedger.Source.CANCEL, request=r, note="Cancelled by employee", created_by=actor)
    else:
        raise ConflictError("NOT_CANCELLABLE", "This request is already closed.")
    r.status = L.CANCELLED
    r.save(update_fields=["status", "updated_at"])
    audit(actor=actor, action="LEAVE_CANCELLED", entity=r, request=request)
    return r


@transaction.atomic
def decide(r: LeaveRequest, actor, decision: str, note: str, request=None) -> LeaveRequest:
    """Super Admin only. Approving posts the ledger debit once; retrospective approval needs a justification (BRD §6.2)."""
    _lock(r.employee)
    r = LeaveRequest.objects.select_for_update().get(pk=r.pk)
    if r.status != L.SUBMITTED:
        raise ConflictError("ALREADY_DECIDED", "This request has already been decided or changed.")
    note = note.strip()
    if decision in ("REJECT", "NEEDS_CHANGES") and len(note) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Add a note for the employee.", field_errors={"note": ["Required."]})
    if decision == "APPROVE":
        if r.start < today() and len(note) < 3:
            raise BusinessRuleError("JUSTIFICATION_REQUIRED", "This leave is in the past. Add a justification to approve it retrospectively.", field_errors={"note": ["Required for past dates."]})
        if r.category == "CO":
            from .holiday_work import consume
            consume(r, actor)
        else:
            bal = balances(r.employee, r.start.year)[r.category]
            if bal["available"] + r.days < r.days:  # its own pending hold is part of `available`
                raise BusinessRuleError("INSUFFICIENT_BALANCE", f"Only {bal['available'] + r.days} {r.category} day(s) left.")
            LeaveLedger.objects.create(organization=r.organization, employee=r.employee, category=r.category, year=r.start.year, days=-r.days,
                                       source=LeaveLedger.Source.LEAVE, request=r, note=note[:200], created_by=actor)
    r.status = {"APPROVE": L.APPROVED, "REJECT": L.REJECTED, "NEEDS_CHANGES": L.NEEDS_CHANGES}[decision]
    r.decision_note, r.decided_by, r.decided_at = note, actor, timezone.now()
    r.save()
    audit(actor=actor, action=f"LEAVE_{r.status}", entity=r, reason=note, request=request)
    word = {"APPROVED": "approved", "REJECTED": "rejected", "NEEDS_CHANGES": "sent back for changes"}[r.status]
    notify(r.employee.user, f"Your {r.get_category_display()} ({r.start:%d %b}) was {word}", note, "/app/leave", tone="success" if r.status == L.APPROVED else "warning")
    queue_email(template_key="leave", recipient=r.employee.official_email, subject=f"Your leave request was {word}",
                body=f"Your {r.get_category_display()} request ({r.start:%d %b}–{r.end:%d %b}) was {word}." + (f"\nNote: {note}" if note else ""),
                dedupe_key=f"leave-decision:{r.pk}:{r.status}", organization=r.organization)
    return r
