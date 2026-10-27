"""Attendance business rules (BRD §4). All times come from the server clock; clients never send punch times."""
import math
from dataclasses import dataclass
from datetime import date, datetime

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from common.errors import BusinessRuleError, ConflictError
from common.models import OfficeSite, PolicyVersion
from common.services import audit
from employees.models import Employee

from .models import AttendanceCorrection, AttendanceDay, AttendanceEvent, Proof

E = AttendanceEvent.Type
PUNCHES = {E.CHECK_IN, E.START_TEA, E.END_TEA, E.START_LUNCH, E.END_LUNCH, E.CHECK_OUT}
WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def now() -> datetime:
    return timezone.now()


# ---------- policy ----------
def policy(org, key: str, default):
    row = PolicyVersion.objects.filter(organization=org, key=key, effective_from__lte=timezone.localdate()).order_by("-effective_from").first()
    return default if row is None else row.value


def thresholds(org) -> dict:
    tea = policy(org, "breaks.tea", {"remind_min": 10, "exceed_min": 15})
    lunch = policy(org, "breaks.lunch", {"remind_min": 40, "exceed_min": 45})
    return {
        "work_seconds": int(policy(org, "attendance.required_work_seconds", 28800)),
        "presence_seconds": int(policy(org, "attendance.required_presence_seconds", 32400)),
        "tea_remind_seconds": int(tea["remind_min"]) * 60,
        "tea_exceed_seconds": int(tea["exceed_min"]) * 60,
        "lunch_remind_seconds": int(lunch["remind_min"]) * 60,
        "lunch_exceed_seconds": int(lunch["exceed_min"]) * 60,
        "escalation_after_seconds": int(policy(org, "breaks.admin_escalation_after_min", 5)) * 60,
        "reverify_interval_seconds": int(policy(org, "geofence.reverify_interval_min", 15)) * 60,
    }


# ---------- geofence ----------
@dataclass
class Location:
    latitude: float
    longitude: float
    accuracy_m: float


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def evaluate_location(site: OfficeSite | None, loc: Location | None, unavailable_reason: str = "") -> tuple[str, int | None, str]:
    """Return (proof, distance_m, note). Never claims physical presence — only that the browser's
    reported position is within the radius (BRD §4.3)."""
    if site is None or site.latitude is None or site.longitude is None:
        return Proof.INCONCLUSIVE, None, "Office location not configured yet"
    if loc is None:
        return Proof.INCONCLUSIVE, None, f"Location unavailable{': ' + unavailable_reason if unavailable_reason else ''}"
    d = haversine_m(float(site.latitude), float(site.longitude), loc.latitude, loc.longitude)
    acc, radius = max(0.0, loc.accuracy_m), site.radius_m
    if d + acc <= radius:
        return Proof.VERIFIED, round(d), ""
    if d - acc > radius:
        return Proof.FAILED, round(d), f"About {round(d)} m from the office"
    return Proof.INCONCLUSIVE, round(d), f"Location accuracy ±{round(acc)} m is too low to confirm"


def office_site(org) -> OfficeSite | None:
    return OfficeSite.objects.filter(organization=org, is_active=True).first()


# ---------- derivation ----------
@dataclass
class Summary:
    state: str
    work: int = 0
    presence: int = 0
    tea: int = 0
    lunch: int = 0
    tea_count: int = 0
    break_started_at: datetime | None = None


def derive(events, as_of: datetime, strict: bool = False) -> Summary:
    """Rebuild totals from punch events (second precision). strict=True rejects impossible sequences."""
    s = Summary(state="NOT_CHECKED_IN")
    check_in = check_out = seg = None
    allowed = {
        E.CHECK_IN: {"NOT_CHECKED_IN"}, E.START_TEA: {"WORKING"}, E.START_LUNCH: {"WORKING"},
        E.END_TEA: {"ON_TEA"}, E.END_LUNCH: {"ON_LUNCH"}, E.CHECK_OUT: {"WORKING", "ON_TEA", "ON_LUNCH"},
    }
    for ev in sorted((e for e in events if e.type in PUNCHES), key=lambda e: (e.at, e.recorded_at or e.at)):
        if s.state not in allowed[ev.type]:
            if strict:
                raise BusinessRuleError("INVALID_SEQUENCE", f"{ev.type.replace('_', ' ').title()} can't follow state {s.state}.")
            continue
        span = int((ev.at - seg).total_seconds()) if seg else 0
        if ev.type == E.CHECK_IN:
            check_in, s.state = ev.at, "WORKING"
        elif ev.type in (E.START_TEA, E.START_LUNCH):
            s.work += span
            s.state = "ON_TEA" if ev.type == E.START_TEA else "ON_LUNCH"
            s.tea_count += ev.type == E.START_TEA
            s.break_started_at = ev.at
        elif ev.type == E.END_TEA:
            s.tea += span
            s.state, s.break_started_at = "WORKING", None
        elif ev.type == E.END_LUNCH:
            s.lunch += span
            s.state, s.break_started_at = "WORKING", None
        elif ev.type == E.CHECK_OUT:
            if s.state == "WORKING":
                s.work += span
            elif s.state == "ON_TEA":
                s.tea += span
            else:
                s.lunch += span
            check_out, s.state, s.break_started_at = ev.at, "CHECKED_OUT", None
        seg = ev.at
    if s.state in ("WORKING", "ON_TEA", "ON_LUNCH") and seg:
        open_span = max(0, int((as_of - seg).total_seconds()))
        if s.state == "WORKING":
            s.work += open_span
        elif s.state == "ON_TEA":
            s.tea += open_span
        else:
            s.lunch += open_span
    if check_in:
        s.presence = max(0, int(((check_out or as_of) - check_in).total_seconds()))
    return s


def store_totals(day: AttendanceDay, s: Summary) -> None:
    day.work_seconds, day.presence_seconds, day.tea_seconds, day.lunch_seconds, day.tea_count = s.work, s.presence, s.tea, s.lunch, s.tea_count


def summary_payload(day: AttendanceDay | None, at: datetime, org) -> dict:
    t = thresholds(org)
    if day is None:
        return {"day": None, "state": "NOT_CHECKED_IN", "server_now": at, "thresholds": t, "events": [],
                "work_seconds": 0, "presence_seconds": 0, "tea_seconds": 0, "lunch_seconds": 0, "tea_count": 0,
                "break_started_at": None, "is_workday": is_workday(org, timezone.localdate(at))}
    events = list(day.events.all())
    s = derive(events, at)
    return {
        "day": {
            "id": str(day.id), "work_date": day.work_date, "status": day.status, "check_in_at": day.check_in_at,
            "check_out_at": day.check_out_at, "proof": day.proof, "proof_note": day.proof_note,
            "review_status": day.review_status, "shortfall_reason": day.shortfall_reason,
            "stale": day.status == AttendanceDay.Status.OPEN and day.work_date < timezone.localdate(at),
        },
        "state": s.state, "server_now": at, "thresholds": t,
        "work_seconds": s.work, "presence_seconds": s.presence, "tea_seconds": s.tea, "lunch_seconds": s.lunch,
        "tea_count": s.tea_count, "break_started_at": s.break_started_at,
        "is_workday": is_workday(org, timezone.localdate(at)),
        "events": [{"type": e.type, "at": e.at, "proof": e.proof, "note": e.note, "by_admin": e.actor_id != day.employee.user_id} for e in events],
    }


def is_workday(org, d: date) -> bool:
    return WEEKDAYS[d.weekday()] in policy(org, "attendance.workdays", ["MON", "TUE", "WED", "THU", "FRI"])


# ---------- employee actions ----------
def _lock(employee: Employee) -> Employee:
    """Serialise all attendance mutations for one person (concurrent tabs, double clicks)."""
    return Employee.objects.select_for_update().get(pk=employee.pk)


def _replayed(employee, key) -> bool:
    return bool(key) and AttendanceEvent.objects.filter(employee=employee, idempotency_key=key).exists()


def open_day(employee) -> AttendanceDay | None:
    return AttendanceDay.objects.filter(employee=employee, status=AttendanceDay.Status.OPEN).first()


def current_day(employee, at: datetime) -> AttendanceDay | None:
    return open_day(employee) or AttendanceDay.objects.filter(employee=employee, work_date=timezone.localdate(at)).first()


def _event(day, type_, *, actor, at, key=None, **extra) -> AttendanceEvent:
    return AttendanceEvent.objects.create(day=day, employee=day.employee, type=type_, at=at, actor=actor, idempotency_key=key or None, **extra)


@transaction.atomic
def check_in(*, employee: Employee, actor, location: Location | None, unavailable_reason: str = "", key: str | None = None, request=None) -> AttendanceDay:
    employee = _lock(employee)
    at = now()
    if _replayed(employee, key):
        return current_day(employee, at)
    today = timezone.localdate(at)
    org = employee.organization
    if not is_workday(org, today):
        raise BusinessRuleError("NOT_A_WORKDAY", "Office attendance is Monday to Friday. Weekend and holiday work arrives with Holiday Work (phase P2).")
    existing = open_day(employee)
    if existing and existing.work_date < today:
        raise ConflictError("PREVIOUS_DAY_OPEN", f"You didn't check out on {existing.work_date:%d %b}. Check out that day first (with a reason), then check in.")
    if existing or AttendanceDay.objects.filter(employee=employee, work_date=today).exists():
        raise ConflictError("ALREADY_CHECKED_IN", "You've already checked in today.")
    proof, distance, note = evaluate_location(office_site(org), location, unavailable_reason)
    day = AttendanceDay.objects.create(
        organization=org, employee=employee, work_date=today, check_in_at=at, proof=proof, proof_note=note,
        review_status=AttendanceDay.Review.NONE if proof == Proof.VERIFIED else AttendanceDay.Review.PENDING,
    )
    _event(day, E.CHECK_IN, actor=actor, at=at, key=key, proof=proof, distance_m=distance, note=note, **_loc_fields(location))
    audit(actor=actor, action="ATTENDANCE_CHECK_IN", entity=day, after={"proof": proof, "work_date": str(today)}, request=request)
    return day


def _loc_fields(location: Location | None) -> dict:
    if location is None:
        return {}
    return {"latitude": round(location.latitude, 6), "longitude": round(location.longitude, 6), "accuracy_m": round(location.accuracy_m)}


@transaction.atomic
def punch(*, employee: Employee, actor, type_: str, key: str | None = None) -> AttendanceDay:
    """START_TEA / START_LUNCH / END_TEA / END_LUNCH."""
    employee = _lock(employee)
    at = now()
    day = open_day(employee)
    if _replayed(employee, key):
        return day or current_day(employee, at)
    if day is None:
        raise ConflictError("NOT_CHECKED_IN", "Check in first.")
    state = derive(day.events.all(), at).state
    rules = {
        E.START_TEA: ("WORKING", "You can start a tea break only while working."),
        E.START_LUNCH: ("WORKING", "You can start lunch only while working — resume from your current break first."),
        E.END_TEA: ("ON_TEA", "You're not on a tea break."),
        E.END_LUNCH: ("ON_LUNCH", "You're not on lunch."),
    }
    need, msg = rules[type_]
    if state != need:
        raise ConflictError("INVALID_STATE", msg)
    _event(day, type_, actor=actor, at=at, key=key)
    return day


@transaction.atomic
def check_out(*, employee: Employee, actor, reason: str = "", location: Location | None = None, key: str | None = None, request=None) -> AttendanceDay:
    """Never blocked by location (BRD §4.1 emergency checkout). Shortfall needs a reason; no automatic LOP."""
    employee = _lock(employee)
    at = now()
    day = open_day(employee)
    if _replayed(employee, key):
        return day or current_day(employee, at)
    if day is None:
        raise ConflictError("NOT_CHECKED_IN", "You're not checked in.")
    s = derive(day.events.all(), at)
    t = thresholds(day.organization)
    short = s.work < t["work_seconds"] or s.presence < t["presence_seconds"]
    reason = reason.strip()
    if (short or day.work_date < timezone.localdate(at)) and not reason:
        raise BusinessRuleError("SHORTFALL_REASON_REQUIRED", "Please give a reason for checking out before completing 8h work and 9h presence.")
    _event(day, E.CHECK_OUT, actor=actor, at=at, key=key, note=reason[:300], **_loc_fields(location))
    final = derive(day.events.all(), at)
    store_totals(day, final)
    day.status, day.check_out_at = AttendanceDay.Status.CLOSED, at
    if reason:
        day.shortfall_reason = reason
        day.review_status = AttendanceDay.Review.PENDING
    day.save()
    audit(actor=actor, action="ATTENDANCE_CHECK_OUT", entity=day, after={"work_seconds": final.work, "presence_seconds": final.presence, "shortfall": short}, request=request)
    return day


@transaction.atomic
def reverify(*, employee: Employee, actor, location: Location | None, unavailable_reason: str = "") -> AttendanceDay:
    """Periodic re-check while the page is open. Logged; never changes worked time (BRD §4.3)."""
    employee = _lock(employee)
    day = open_day(employee)
    if day is None:
        raise ConflictError("NOT_CHECKED_IN", "You're not checked in.")
    proof, distance, note = evaluate_location(office_site(day.organization), location, unavailable_reason)
    _event(day, E.LOCATION_VERIFIED if proof == Proof.VERIFIED else E.VERIFICATION_FAILED, actor=actor, at=now(),
           proof=proof, distance_m=distance, note=note, **_loc_fields(location))
    if proof != Proof.VERIFIED and day.proof == Proof.VERIFIED:
        day.proof, day.proof_note = Proof.INCONCLUSIVE, f"Re-check at {timezone.localtime(now()):%H:%M}: {note}"
        day.review_status = AttendanceDay.Review.PENDING
        day.save(update_fields=["proof", "proof_note", "review_status", "updated_at"])
    return day


# ---------- corrections ----------
@transaction.atomic
def request_correction(*, day: AttendanceDay, actor, event_type: str, proposed_at: datetime, reason: str) -> AttendanceCorrection:
    if proposed_at <= day.check_in_at or proposed_at > now():
        raise BusinessRuleError("INVALID_TIME", "Pick a time after your check-in and not in the future.")
    if day.corrections.filter(status=AttendanceCorrection.Status.PENDING, event_type=event_type).exists():
        raise ConflictError("CORRECTION_PENDING", "You already have a pending request for this.")
    c = AttendanceCorrection.objects.create(day=day, requested_by=actor, event_type=event_type, proposed_at=proposed_at, reason=reason.strip())
    _event(day, E.CORRECTION_REQUESTED, actor=actor, at=now(), note=f"{event_type} at {timezone.localtime(proposed_at):%H:%M}: {reason[:200]}")
    audit(actor=actor, action="ATTENDANCE_CORRECTION_REQUESTED", entity=c, after={"event_type": event_type, "proposed_at": proposed_at.isoformat()}, organization=day.organization)
    return c


@transaction.atomic
def decide_correction(*, correction: AttendanceCorrection, actor, approve: bool, note: str, request=None) -> AttendanceCorrection:
    c = AttendanceCorrection.objects.select_for_update().select_related("day").get(pk=correction.pk)
    if c.status != AttendanceCorrection.Status.PENDING:
        raise ConflictError("ALREADY_DECIDED", "This request was already decided.")
    day = AttendanceDay.objects.select_for_update().get(pk=c.day_id)
    before = {"status": day.status, "work_seconds": day.work_seconds, "check_out_at": day.check_out_at.isoformat() if day.check_out_at else None}
    if approve:
        at = now()
        new = AttendanceEvent(day=day, employee=day.employee, type=c.event_type, at=c.proposed_at, actor=actor, note=f"Correction approved: {note}"[:300])
        derive([*day.events.all(), new], at, strict=True)  # reject impossible results before writing
        new.save()
        _event(day, E.CORRECTION_APPROVED, actor=actor, at=at, note=f"{c.event_type} at {timezone.localtime(c.proposed_at):%H:%M}"[:300])
        s = derive(day.events.all(), at)
        store_totals(day, s)
        if c.event_type == E.CHECK_OUT:
            day.status, day.check_out_at = AttendanceDay.Status.CLOSED, c.proposed_at
        day.save()
    c.status = AttendanceCorrection.Status.APPROVED if approve else AttendanceCorrection.Status.REJECTED
    c.reviewed_by, c.reviewed_at, c.decision_note = actor, now(), note
    c.save()
    after = {"status": day.status, "work_seconds": day.work_seconds, "check_out_at": day.check_out_at.isoformat() if day.check_out_at else None}
    audit(actor=actor, action="ATTENDANCE_CORRECTION_" + c.status, entity=c, before=before, after=after, reason=note, request=request, organization=day.organization)
    return c


@transaction.atomic
def review_day(*, day: AttendanceDay, actor, action: str, note: str, request=None) -> AttendanceDay:
    """ACCEPT_PROOF: Super Admin verified presence manually. ACKNOWLEDGE: shortfall/exception reviewed. Neither changes time."""
    day = AttendanceDay.objects.select_for_update().get(pk=day.pk)
    before = {"proof": day.proof, "review_status": day.review_status}
    if action == "ACCEPT_PROOF":
        if day.proof not in (Proof.INCONCLUSIVE, Proof.FAILED):
            raise ConflictError("NOTHING_TO_ACCEPT", "This day's location is already verified.")
        day.proof = Proof.ADMIN_OVERRIDE
        # An early check-out on the same day is a separate review; accepting location doesn't clear it.
        still_pending = bool(day.shortfall_reason)
    else:
        still_pending = False
    day.review_status = AttendanceDay.Review.PENDING if still_pending else AttendanceDay.Review.REVIEWED
    day.review_note, day.reviewed_by = note, actor
    day.save()
    audit(actor=actor, action=f"ATTENDANCE_{action}", entity=day, before=before, after={"proof": day.proof, "review_status": day.review_status}, reason=note, request=request)
    return day


# ---------- admin views ----------
ACTIVE = [Employee.Status.PROBATION, Employee.Status.ACTIVE_CONFIRMED, Employee.Status.NOTICE_PERIOD]


def live_board(org) -> dict:
    at = now()
    today = timezone.localdate(at)
    t = thresholds(org)
    emps = list(Employee.objects.filter(organization=org, status__in=ACTIVE).select_related("department"))
    days = {d.employee_id: d for d in AttendanceDay.objects.filter(employee__in=emps).filter(work_date=today).prefetch_related("events")}
    for d in AttendanceDay.objects.filter(employee__in=emps, status=AttendanceDay.Status.OPEN, work_date__lt=today).prefetch_related("events"):
        days.setdefault(d.employee_id, d)
    rows, counts = [], {k: 0 for k in ["WORKING", "ON_TEA", "ON_LUNCH", "CHECKED_OUT", "NOT_ARRIVED", "PROOF_REVIEW"]}
    for e in emps:
        d = days.get(e.id)
        s = derive(d.events.all(), at) if d else None
        state = s.state if s else "NOT_ARRIVED"
        counts[state if state in counts else "NOT_ARRIVED"] += 1
        flags = []
        if d and d.proof in (Proof.INCONCLUSIVE, Proof.FAILED) and d.review_status != AttendanceDay.Review.REVIEWED:
            counts["PROOF_REVIEW"] += 1
            flags.append("Location " + d.proof.lower())
        if s and s.break_started_at:
            limit = t["tea_exceed_seconds"] if state == "ON_TEA" else t["lunch_exceed_seconds"]
            over = int((at - s.break_started_at).total_seconds()) - limit
            if over > 0:
                flags.append(f"{'Tea' if state == 'ON_TEA' else 'Lunch'} over by {over // 60} min")
        if d and d.work_date < today:
            flags.append("Missing check-out")
        if d and d.status == AttendanceDay.Status.CLOSED and d.shortfall_reason:
            flags.append("Early check-out")
        rows.append({
            "employee": {"id": str(e.id), "display_name": e.display_name, "employee_code": e.employee_code, "designation": e.designation, "department": e.department.name},
            "day_id": str(d.id) if d else None, "state": state, "check_in_at": d.check_in_at if d else None,
            "check_out_at": d.check_out_at if d else None, "work_seconds": s.work if s else 0, "presence_seconds": s.presence if s else 0,
            "break_started_at": s.break_started_at if s else None, "proof": d.proof if d else None, "flags": flags,
        })
    return {"server_now": at, "work_date": today, "counts": counts, "rows": rows, "thresholds": t}


def exceptions_queue(org) -> list[dict]:
    """Prioritised review list (BRD §27.2 Admin Exceptions)."""
    at = now()
    today = timezone.localdate(at)
    items = []
    pending_days = (AttendanceDay.objects.filter(organization=org)
                    .exclude(review_status=AttendanceDay.Review.REVIEWED)
                    .filter(Q(review_status=AttendanceDay.Review.PENDING) | Q(status=AttendanceDay.Status.OPEN, work_date__lt=today)).select_related("employee").prefetch_related("events"))
    for d in pending_days:
        base = {"day_id": str(d.id), "employee": d.employee.display_name, "employee_code": d.employee.employee_code, "work_date": d.work_date,
                "check_in_at": d.check_in_at, "check_out_at": d.check_out_at, "proof": d.proof, "proof_note": d.proof_note,
                "shortfall_reason": d.shortfall_reason, "work_seconds": derive(d.events.all(), at).work}
        if d.proof == Proof.FAILED:
            items.append({**base, "kind": "GEO_FAILED", "priority": 1, "title": "Checked in outside the office radius"})
        elif d.proof == Proof.INCONCLUSIVE:
            items.append({**base, "kind": "GEO_INCONCLUSIVE", "priority": 2, "title": "Location couldn't be confirmed"})
        if d.status == AttendanceDay.Status.OPEN and d.work_date < today:
            items.append({**base, "kind": "MISSING_CHECKOUT", "priority": 3, "title": "No check-out recorded"})
        if d.status == AttendanceDay.Status.CLOSED and d.shortfall_reason:
            items.append({**base, "kind": "SHORTFALL", "priority": 5, "title": "Checked out before 8h work / 9h presence"})
    for c in AttendanceCorrection.objects.filter(day__organization=org, status=AttendanceCorrection.Status.PENDING).select_related("day__employee"):
        items.append({"kind": "CORRECTION", "priority": 6, "title": f"Correction: {c.get_event_type_display()}", "correction_id": str(c.id),
                      "day_id": str(c.day_id), "employee": c.day.employee.display_name, "employee_code": c.day.employee.employee_code,
                      "work_date": c.day.work_date, "proposed_at": c.proposed_at, "reason": c.reason})
    return sorted(items, key=lambda i: (i["priority"], str(i["work_date"])))
