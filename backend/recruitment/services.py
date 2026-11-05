"""Recruitment rules (BRD §9). HR runs the process; only the Super Admin selects a candidate, sets salary and approves an offer."""
import hashlib
import re
import secrets
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from attendance.services import policy
from common.errors import BusinessRuleError, ConflictError
from common.services import audit, notify, queue_email, super_admins
from employees.models import Employee

from .models import Candidate, Feedback, InterviewRound, Offer, ScorecardTemplate

C = Candidate.Stage
O = Offer.Status
EVALUATIONS = ("GOOD", "AVERAGE", "NEEDS_IMPROVEMENT", "NOT_EVALUATED")
REDACTED = "[Salary: added by the Super Admin on approval]"

DEFAULT_TEMPLATES = {
    "DEVELOPER": ("Developer", [("coding", "Coding ability", 2, True), ("js_react", "JavaScript / React", 2, False), ("problem_solving", "Problem solving", 2, True),
                                ("quality", "Code quality and testing", 1, False), ("collaboration", "Collaboration and communication", 1, False)]),
    "SALES": ("Sales", [("targets", "Track record against targets", 2, True), ("negotiation", "Negotiation", 2, False), ("follow_up", "Follow-up discipline", 1, False),
                        ("conversion", "Conversion skills", 2, True)]),
    "PRESALES": ("Pre-sales", [("requirements", "Requirements discovery", 2, True), ("demos", "Product demos", 2, False), ("product_knowledge", "Product knowledge", 1, False)]),
    "GENERAL": ("General", [("role_knowledge", "Role knowledge", 2, True), ("problem_solving", "Problem solving", 1, False), ("communication", "Communication", 1, False),
                            ("culture", "Culture and values", 1, False)]),
}


def _digits(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")[-10:]


def _hr_and_admins(org):
    from accounts.models import Role, User
    return User.objects.filter(organization=org, is_active=True, role_assignments__role__in=[Role.SUPER_ADMIN, Role.HR_OPERATIONS]).distinct()


# ---------- scorecard templates ----------
def template(org, code: str) -> ScorecardTemplate:
    code = code if code in DEFAULT_TEMPLATES else "GENERAL"
    t = ScorecardTemplate.objects.filter(organization=org, code=code).order_by("-version").first()
    if t:
        return t
    name, qs = DEFAULT_TEMPLATES[code]
    return ScorecardTemplate.objects.create(organization=org, code=code, name=name,
                                            questions=[{"key": k, "text": t_, "weight": w, "evidence_required": e} for k, t_, w, e in qs])


# ---------- candidates ----------
def find_duplicate(org, email: str, phone: str, exclude=None) -> Candidate | None:
    d = _digits(phone)
    match = Q(email__iexact=email.strip()) | (Q(phone__endswith=d[-4:]) if d else Q(pk__in=[]))
    for c in Candidate.objects.filter(organization=org).exclude(pk=exclude).filter(match):
        if c.email.lower() == email.strip().lower() or (d and _digits(c.phone) == d):
            return c
    return None


@transaction.atomic
def create_candidate(org, actor, *, name, email, phone, role_applied, department=None, template_code="GENERAL", source="", notes="", resume=None, request=None) -> Candidate:
    name, email = name.strip(), email.strip().lower()
    if len(name) < 2:
        raise BusinessRuleError("NAME_REQUIRED", "Enter the candidate's name.", field_errors={"name": ["Required."]})
    if len(_digits(phone)) < 10:
        raise BusinessRuleError("INVALID_PHONE", "Enter a 10-digit phone number.", field_errors={"phone": ["10 digits."]})
    if Employee.objects.filter(organization=org, official_email__iexact=email).exists():
        raise ConflictError("ALREADY_EMPLOYEE", "This email belongs to an employee.")
    dup = find_duplicate(org, email, phone)
    if dup:
        raise ConflictError("DUPLICATE_CANDIDATE", f"{dup.name} is already in the system with this email or phone ({dup.get_stage_display().lower()}).", field_errors={"existing": [str(dup.id)]})
    c = Candidate.objects.create(organization=org, name=name, email=email, phone=phone.strip(), role_applied=role_applied.strip(), department=department,
                                 template_code=template_code if template_code in DEFAULT_TEMPLATES else "GENERAL", source=source.strip(), notes=notes, resume=resume, created_by=actor)
    audit(actor=actor, action="CANDIDATE_CREATED", entity=c, after={"role": c.role_applied}, request=request)
    return c


def update_candidate(c: Candidate, actor, data: dict, request=None) -> Candidate:
    if c.stage in Candidate.CLOSED:
        raise ConflictError("CANDIDATE_CLOSED", "This candidate is closed.")
    if "email" in data or "phone" in data:
        dup = find_duplicate(c.organization, data.get("email", c.email), data.get("phone", c.phone), exclude=c.pk)
        if dup:
            raise ConflictError("DUPLICATE_CANDIDATE", f"{dup.name} already has this email or phone.", field_errors={"existing": [str(dup.id)]})
    for k in ("name", "email", "phone", "role_applied", "department", "template_code", "source", "notes", "resume"):
        if k in data:
            setattr(c, k, data[k])
    c.save()
    audit(actor=actor, action="CANDIDATE_UPDATED", entity=c, after={k: str(v) for k, v in data.items() if k != "resume"}, request=request)
    return c


def withdraw(c: Candidate, actor, note: str, request=None) -> Candidate:
    if c.stage in Candidate.CLOSED or c.stage == C.OFFER_ACCEPTED:
        raise ConflictError("CANDIDATE_CLOSED", "This candidate can't be withdrawn now.")
    if len(note.strip()) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Say why the candidate is withdrawn.")
    Offer.objects.filter(candidate=c, status__in=[O.DRAFT, O.PENDING_ADMIN, O.SENT]).update(status=O.WITHDRAWN)
    c.rounds.filter(status=InterviewRound.Status.SCHEDULED).update(status=InterviewRound.Status.CANCELLED)
    c.stage, c.decision_note = C.WITHDRAWN, note.strip()
    c.save(update_fields=["stage", "decision_note", "updated_at"])
    audit(actor=actor, action="CANDIDATE_WITHDRAWN", entity=c, reason=note, request=request)
    return c


# ---------- interviews ----------
def _invite(r: InterviewRound, update: bool):
    org, c = r.organization, r.candidate
    when = timezone.localtime(r.scheduled_at).strftime("%a %d %b %Y, %I:%M %p IST")
    where = f"Online: {r.meeting_url}" if r.mode == "ONLINE" else f"At the office: {r.location}"
    verb = "Updated: " if update else ""
    queue_email(template_key="interview", recipient=c.email, subject=f"{verb}Interview with {org.legal_name} on {when}",
                body=f"Hello {c.name},\n\nYour {r.get_kind_display().lower()} interview for {c.role_applied} is on {when} ({r.duration_min} minutes).\n{where}\n\nRegards,\n{org.legal_name}",
                dedupe_key=f"interview:{r.pk}:{r.reschedules}:{r.status}:cand", organization=org)
    for e in r.interviewers.all():
        queue_email(template_key="interview", recipient=e.official_email, subject=f"{verb}Interview: {c.name} ({c.role_applied}) on {when}",
                    body=f"You're interviewing {c.name} for {c.role_applied} on {when}.\n{where}\nOpen Antro HRMS → My Interviews for the résumé and scorecard.",
                    dedupe_key=f"interview:{r.pk}:{r.reschedules}:{r.status}:{e.pk}", organization=org)
    notify([e.user for e in r.interviewers.all()], f"{verb}Interview: {c.name} on {when}", c.role_applied, "/app/interviews")


def _check_slot(org, *, scheduled_at, mode, meeting_url, location, interviewers, duration_min):
    if scheduled_at < timezone.now():
        raise BusinessRuleError("IN_THE_PAST", "Pick a time in the future.", field_errors={"scheduled_at": ["Must be in the future."]})
    if not (15 <= duration_min <= 240):
        raise BusinessRuleError("INVALID_DURATION", "Interviews run 15 to 240 minutes.")
    if mode == "ONLINE" and not meeting_url.startswith("https://"):
        raise BusinessRuleError("MEETING_URL_REQUIRED", "Paste the meeting link (it must start with https://).", field_errors={"meeting_url": ["https:// link required."]})
    if mode == "ONSITE" and len(location.strip()) < 5:
        raise BusinessRuleError("LOCATION_REQUIRED", "Enter the office address.", field_errors={"location": ["Required."]})
    if not interviewers:
        raise BusinessRuleError("INTERVIEWER_REQUIRED", "Assign at least one interviewer.", field_errors={"interviewers": ["Required."]})
    if any(e.organization_id != org.id or e.status in ("EXITED", "INACTIVE", "PREBOARDING") for e in interviewers):
        raise BusinessRuleError("INVALID_INTERVIEWER", "Interviewers must be current employees.")


@transaction.atomic
def schedule(c: Candidate, actor, *, kind, scheduled_at, mode, meeting_url="", location="", interviewers, duration_min=45, request=None) -> InterviewRound:
    if c.stage not in (C.NEW, C.INTERVIEWING, C.SELECTION_PENDING):
        raise ConflictError("CANDIDATE_CLOSED", "Interviews can only be scheduled before a selection decision.")
    _check_slot(c.organization, scheduled_at=scheduled_at, mode=mode, meeting_url=meeting_url, location=location, interviewers=interviewers, duration_min=duration_min)
    r = InterviewRound.objects.create(organization=c.organization, candidate=c, kind=kind, scheduled_at=scheduled_at, duration_min=duration_min, mode=mode,
                                      meeting_url=meeting_url if mode == "ONLINE" else "", location=location.strip() if mode == "ONSITE" else "",
                                      template=template(c.organization, c.template_code), created_by=actor)
    r.interviewers.set(interviewers)
    c.stage = C.INTERVIEWING
    c.save(update_fields=["stage", "updated_at"])
    audit(actor=actor, action="INTERVIEW_SCHEDULED", entity=r, after={"candidate": str(c.id), "at": str(scheduled_at)}, request=request)
    _invite(r, update=False)
    return r


@transaction.atomic
def reschedule(r: InterviewRound, actor, *, scheduled_at, mode, meeting_url="", location="", interviewers, duration_min=45, request=None) -> InterviewRound:
    r = InterviewRound.objects.select_for_update().get(pk=r.pk)
    if r.status != InterviewRound.Status.SCHEDULED or r.feedback.filter(submitted_at__isnull=False).exists():
        raise ConflictError("ROUND_CLOSED", "This round is finished or cancelled.")
    _check_slot(r.organization, scheduled_at=scheduled_at, mode=mode, meeting_url=meeting_url, location=location, interviewers=interviewers, duration_min=duration_min)
    before = {"at": str(r.scheduled_at), "interviewers": [str(e.pk) for e in r.interviewers.all()]}
    r.scheduled_at, r.mode, r.duration_min = scheduled_at, mode, duration_min
    r.meeting_url, r.location = (meeting_url if mode == "ONLINE" else ""), (location.strip() if mode == "ONSITE" else "")
    r.reschedules += 1
    r.save()
    r.interviewers.set(interviewers)
    audit(actor=actor, action="INTERVIEW_RESCHEDULED", entity=r, before=before, after={"at": str(scheduled_at)}, request=request)
    _invite(r, update=True)
    return r


@transaction.atomic
def cancel_round(r: InterviewRound, actor, request=None) -> InterviewRound:
    r = InterviewRound.objects.select_for_update().get(pk=r.pk)
    if r.status != InterviewRound.Status.SCHEDULED or r.feedback.filter(submitted_at__isnull=False).exists():
        raise ConflictError("ROUND_CLOSED", "This round has feedback or is already closed.")
    r.status = InterviewRound.Status.CANCELLED
    r.save(update_fields=["status"])
    audit(actor=actor, action="INTERVIEW_CANCELLED", entity=r, request=request)
    c, org = r.candidate, r.organization
    queue_email(template_key="interview", recipient=c.email, subject=f"Interview cancelled: {org.legal_name}",
                body=f"Hello {c.name},\n\nYour interview on {timezone.localtime(r.scheduled_at):%d %b at %I:%M %p} is cancelled. We'll be in touch.\n\n{org.legal_name}",
                dedupe_key=f"interview:{r.pk}:cancel:cand", organization=org)
    notify([e.user for e in r.interviewers.all()], f"Interview cancelled: {c.name}", "", "/app/interviews", tone="warning")
    return r


# ---------- feedback ----------
def score(questions: list[dict], answers: list[dict]) -> Decimal | None:
    """Weighted average of 1–5 ratings; NOT_EVALUATED questions drop out of both sides."""
    weights = {q["key"]: Decimal(str(q["weight"])) for q in questions}
    num = den = Decimal(0)
    for a in answers:
        if a.get("evaluation") != "NOT_EVALUATED" and a.get("rating"):
            num += weights[a["key"]] * Decimal(a["rating"])
            den += weights[a["key"]]
    return (num / den).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if den else None


def assigned(employee: Employee, r: InterviewRound) -> bool:
    return r.interviewers.filter(pk=employee.pk).exists()


@transaction.atomic
def save_feedback(r: InterviewRound, employee: Employee, *, answers: list[dict], overall: str, comments: str, submit: bool, amend_reason: str = "", request=None) -> Feedback:
    r = InterviewRound.objects.select_for_update().get(pk=r.pk)
    if not assigned(employee, r):
        raise BusinessRuleError("NOT_ASSIGNED", "You're not an interviewer for this round.")
    if r.status == InterviewRound.Status.CANCELLED:
        raise ConflictError("ROUND_CLOSED", "This round was cancelled.")
    if r.scheduled_at > timezone.now():
        raise BusinessRuleError("NOT_YET", "Feedback opens when the interview starts.")
    latest = Feedback.objects.filter(round=r, interviewer=employee).order_by("-revision").first()
    if latest and latest.submitted_at:
        if len(amend_reason.strip()) < 5:
            raise BusinessRuleError("AMEND_REASON_REQUIRED", "Feedback is locked. Say why you're amending it; it's saved as a new revision.")
        if r.candidate.stage not in (C.INTERVIEWING, C.SELECTION_PENDING):
            raise ConflictError("DECISION_MADE", "The selection decision is made; feedback can't change now.")
        fb = Feedback(round=r, interviewer=employee, revision=latest.revision + 1, amend_reason=amend_reason.strip()[:300])
    else:
        fb = latest or Feedback(round=r, interviewer=employee)
    qs = {q["key"]: q for q in r.template.questions}
    clean = []
    for a in answers:
        q = qs.get(a.get("key"))
        if not q:
            continue
        ev = a.get("evaluation") or "NOT_EVALUATED"
        rating = a.get("rating")
        if ev not in EVALUATIONS or (rating is not None and rating not in (1, 2, 3, 4, 5)):
            raise BusinessRuleError("INVALID_ANSWER", f"Check “{q['text']}”: rating 1–5 and a valid evaluation.")
        clean.append({"key": q["key"], "rating": None if ev == "NOT_EVALUATED" else rating, "evaluation": ev, "remark": str(a.get("remark", ""))[:1000]})
    if submit:
        got = {a["key"]: a for a in clean}
        for q in r.template.questions:
            a = got.get(q["key"])
            if not a:
                raise BusinessRuleError("ANSWER_REQUIRED", f"Answer “{q['text']}” (or mark it Not evaluated).")
            if a["evaluation"] != "NOT_EVALUATED" and not a["rating"]:
                raise BusinessRuleError("RATING_REQUIRED", f"Give “{q['text']}” a 1–5 rating.")
            if q.get("evidence_required") and a["evaluation"] != "NOT_EVALUATED" and len(a["remark"].strip()) < 5:
                raise BusinessRuleError("EVIDENCE_REQUIRED", f"Add an evidence remark for “{q['text']}”.")
        if overall not in Feedback.Overall.values:
            raise BusinessRuleError("OVERALL_REQUIRED", "Choose Recommended, Not recommended or Next round.")
        if all(a["evaluation"] == "NOT_EVALUATED" for a in clean):
            raise BusinessRuleError("NOTHING_EVALUATED", "Evaluate at least one question.")
    fb.answers, fb.overall, fb.comments = clean, overall if overall in Feedback.Overall.values else "", comments.strip()
    fb.score = score(r.template.questions, clean)
    if submit:
        fb.submitted_at = timezone.now()
    fb.save()
    if submit:
        audit(actor=employee.user, action="FEEDBACK_SUBMITTED" if fb.revision == 1 else "FEEDBACK_AMENDED", entity=r, after={"revision": fb.revision, "score": str(fb.score), "overall": fb.overall}, reason=fb.amend_reason, request=request)
        _after_feedback(r)
    return fb


def _after_feedback(r: InterviewRound):
    """Round complete once every interviewer has submitted. Candidate goes to selection when no scheduled rounds remain."""
    submitted = set(Feedback.objects.filter(round=r, submitted_at__isnull=False).values_list("interviewer_id", flat=True))
    if submitted >= set(r.interviewers.values_list("pk", flat=True)) and r.status == InterviewRound.Status.SCHEDULED:
        r.status = InterviewRound.Status.COMPLETED
        r.save(update_fields=["status"])
    c = r.candidate
    if c.stage == C.INTERVIEWING and not c.rounds.filter(status=InterviewRound.Status.SCHEDULED).exists():
        c.stage = C.SELECTION_PENDING
        c.save(update_fields=["stage", "updated_at"])
        admins = list(super_admins(c.organization))
        notify(admins, f"Selection decision: {c.name}", f"All interviews for {c.role_applied} are scored.", "/console/hiring")


def latest_feedback(c: Candidate) -> list[Feedback]:
    out, seen = [], set()
    for fb in Feedback.objects.filter(round__candidate=c, submitted_at__isnull=False).select_related("interviewer", "round").order_by("round__scheduled_at", "interviewer", "-revision"):
        if (fb.round_id, fb.interviewer_id) not in seen:
            seen.add((fb.round_id, fb.interviewer_id))
            out.append(fb)
    return out


# ---------- selection (Super Admin only) ----------
@transaction.atomic
def decide_candidate(c: Candidate, actor, decision: str, note: str, request=None) -> Candidate:
    c = Candidate.objects.select_for_update().get(pk=c.pk)
    if c.stage not in (C.INTERVIEWING, C.SELECTION_PENDING):
        raise ConflictError("NOT_PENDING", "This candidate isn't waiting for a selection decision.")
    if not latest_feedback(c):
        raise BusinessRuleError("INCOMPLETE_FEEDBACK", "No submitted interview feedback yet. Wait for at least one scorecard.")
    if c.rounds.filter(status=InterviewRound.Status.SCHEDULED).exists() and decision == "SELECT":
        raise BusinessRuleError("ROUNDS_PENDING", "Some interviews are still open. Finish or cancel them first.")
    note = note.strip()
    if decision == "REJECT" and len(note) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Add a note for the record.")
    c.stage = C.SELECTED if decision == "SELECT" else C.REJECTED
    c.decision_note, c.decided_by, c.decided_at = note, actor, timezone.now()
    c.save()
    audit(actor=actor, action=f"CANDIDATE_{c.stage}", entity=c, reason=note, request=request)
    notify(list(_hr_and_admins(c.organization).exclude(pk=actor.pk)), f"{c.name} was {'selected' if c.stage == C.SELECTED else 'not selected'}",
           "Draft the offer next." if c.stage == C.SELECTED else note, "/hr/recruitment", tone="success" if c.stage == C.SELECTED else "info")
    return c


# ---------- offers ----------
def _fmt_money(x: Decimal) -> str:
    return f"₹{x:,.2f}"


def render_letter(o: Offer, redact: bool) -> str:
    org, c = o.organization, o.candidate
    gross = REDACTED if redact or o.monthly_gross is None else f"{_fmt_money(o.monthly_gross)} per month (gross), {_fmt_money(o.monthly_gross * 12)} per year"
    mgr = f"\nYou will report to {o.reporting_manager.display_name}, {o.reporting_manager.designation}." if o.reporting_manager else ""
    probation = int(policy(org, "employees.probation_months", 3))
    return (f"{org.legal_name}\n\nOffer of employment\n\nDear {c.name},\n\n"
            f"We are pleased to offer you the position of {o.designation} in our {o.department.name} team, on a "
            f"{o.employment_type.replace('_', '-').lower()} basis, starting on {o.joining_date:%d %B %Y} at {o.work_location}.{mgr}\n\n"
            f"Compensation: {gross}.\n\n"
            f"Your first {probation} months are a probation period. Leave and other statutory rights apply from your first day.\n\n"
            + (f"{o.terms.strip()}\n\n" if o.terms.strip() else "")
            + f"Please accept or decline this offer using the secure link in your email before it expires.\n\nRegards,\n{org.legal_name}")


def _validate_offer(o: Offer):
    if o.joining_date <= timezone.localdate():
        raise BusinessRuleError("JOINING_IN_PAST", "The joining date must be in the future.", field_errors={"joining_date": ["Future date."]})
    if len(o.designation.strip()) < 2 or len(o.work_location.strip()) < 3:
        raise BusinessRuleError("DETAILS_REQUIRED", "Fill in designation and work location.")


@transaction.atomic
def draft_offer(c: Candidate, actor, data: dict, request=None) -> Offer:
    c = Candidate.objects.select_for_update().get(pk=c.pk)
    o = Offer.objects.filter(candidate=c, status__in=[O.DRAFT]).first()
    if o is None:
        if c.stage != C.SELECTED:
            raise BusinessRuleError("NOT_SELECTED", "The Super Admin must select this candidate before an offer is drafted.")
        if Offer.objects.filter(candidate=c, status__in=Offer.OPEN).exists():
            raise ConflictError("OFFER_OPEN", "This candidate already has an open offer.")
        o = Offer(organization=c.organization, candidate=c, created_by=actor)
    for k in ("designation", "department", "employment_type", "joining_date", "reporting_manager", "work_location", "terms"):
        if k in data:
            setattr(o, k, data[k])
    _validate_offer(o)
    o.save()
    audit(actor=actor, action="OFFER_DRAFTED", entity=o, after={"designation": o.designation, "joining": str(o.joining_date)}, request=request)
    return o


@transaction.atomic
def submit_offer(o: Offer, actor, request=None) -> Offer:
    o = Offer.objects.select_for_update().get(pk=o.pk)
    if o.status != O.DRAFT:
        raise ConflictError("NOT_DRAFT", "Only a draft can be sent for approval.")
    _validate_offer(o)
    o.status = O.PENDING_ADMIN
    o.save(update_fields=["status", "updated_at"])
    audit(actor=actor, action="OFFER_SUBMITTED", entity=o, request=request)
    notify(list(super_admins(o.organization)), f"Offer to approve: {o.candidate.name}", f"{o.designation}, joining {o.joining_date:%d %b}. Add the salary and approve.", "/console/hiring")
    return o


def _token() -> tuple[str, str]:
    t = secrets.token_urlsafe(32)
    return t, hashlib.sha256(t.encode()).hexdigest()


@transaction.atomic
def decide_offer(o: Offer, actor, decision: str, note: str, monthly_gross=None, web_base: str = "", request=None) -> Offer:
    """APPROVE sets salary, freezes the letter (SHA-256), and emails the candidate exactly once. NEEDS_CHANGES returns it to HR."""
    o = Offer.objects.select_for_update().get(pk=o.pk)
    if o.status != O.PENDING_ADMIN:
        raise ConflictError("NOT_PENDING", "This offer isn't waiting for approval.")
    note = note.strip()
    if decision == "NEEDS_CHANGES":
        if len(note) < 3:
            raise BusinessRuleError("NOTE_REQUIRED", "Tell HR what to change.")
        o.status, o.admin_note = O.DRAFT, note
        o.save(update_fields=["status", "admin_note", "updated_at"])
        audit(actor=actor, action="OFFER_RETURNED", entity=o, reason=note, request=request)
        notify(list(_hr_and_admins(o.organization).exclude(pk=actor.pk)), f"Offer for {o.candidate.name} needs changes", note, "/hr/recruitment", tone="warning")
        return o
    if decision != "APPROVE":
        raise BusinessRuleError("INVALID_DECISION", "Unknown decision.")
    try:
        gross = Decimal(str(monthly_gross)).quantize(Decimal("0.01"))
    except Exception:
        gross = None
    if gross is None or gross <= 0 or gross > Decimal("10000000"):
        raise BusinessRuleError("SALARY_REQUIRED", "Enter the monthly gross salary.", field_errors={"monthly_gross": ["Required."]})
    _validate_offer(o)
    days = int(policy(o.organization, "offers.valid_days", 7))
    token, o.token_hash = _token()
    o.monthly_gross, o.admin_note, o.approved_by, o.approved_at = gross, note, actor, timezone.now()
    o.letter = render_letter(o, redact=False)
    o.digest = hashlib.sha256(o.letter.encode()).hexdigest()
    o.expires_at = timezone.now() + timedelta(days=days)
    o.status = O.SENT
    o.save()
    c = o.candidate
    c.stage = C.OFFERED
    c.save(update_fields=["stage", "updated_at"])
    audit(actor=actor, action="OFFER_APPROVED_AND_SENT", entity=o, after={"digest": o.digest, "expires_at": str(o.expires_at)}, request=request)
    link = f"{web_base}/candidate/offer/{token}"
    queue_email(template_key="offer", recipient=c.email, subject=f"Your offer from {o.organization.legal_name}",
                body=f"Dear {c.name},\n\nWe're delighted to offer you the role of {o.designation}. Read your offer letter and accept or decline here:\n{link}\n\n"
                     f"This link is personal and expires on {timezone.localtime(o.expires_at):%d %b %Y}.\n\n{o.organization.legal_name}",
                dedupe_key=f"offer-sent:{o.pk}", organization=o.organization)
    notify(list(_hr_and_admins(o.organization).exclude(pk=actor.pk)), f"Offer sent to {c.name}", f"{o.designation}, joining {o.joining_date:%d %b}.", "/hr/recruitment", tone="success")
    return o


@transaction.atomic
def withdraw_offer(o: Offer, actor, note: str, request=None) -> Offer:
    o = Offer.objects.select_for_update().get(pk=o.pk)
    if o.status not in (O.DRAFT, O.PENDING_ADMIN, O.SENT):
        raise ConflictError("OFFER_CLOSED", "This offer can't be withdrawn.")
    if len(note.strip()) < 3:
        raise BusinessRuleError("NOTE_REQUIRED", "Say why the offer is withdrawn.")
    was_sent = o.status == O.SENT
    o.status, o.admin_note = O.WITHDRAWN, note.strip()
    o.save(update_fields=["status", "admin_note", "updated_at"])
    if was_sent:
        o.candidate.stage = C.SELECTED
        o.candidate.save(update_fields=["stage", "updated_at"])
    audit(actor=actor, action="OFFER_WITHDRAWN", entity=o, reason=note, request=request)
    return o


def by_token(token: str) -> Offer | None:
    if not token or len(token) > 100:
        return None
    o = Offer.objects.filter(token_hash=hashlib.sha256(token.encode()).hexdigest()).select_related("candidate", "organization").first()
    if o and o.status == O.SENT and o.expires_at and o.expires_at < timezone.now():
        o.status = O.EXPIRED
        o.save(update_fields=["status", "updated_at"])
        o.candidate.stage = C.SELECTED
        o.candidate.save(update_fields=["stage", "updated_at"])
        audit(actor=None, action="OFFER_EXPIRED", entity=o)
    return o


def _ip_prefix(request) -> str:
    ip = (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")) if request else ""
    if "." in ip:
        return ".".join(ip.split(".")[:3]) + ".0/24"
    return ":".join(ip.split(":")[:3]) + "::/48" if ":" in ip else ""


@transaction.atomic
def respond(token: str, decision: str, signed_name: str, consent: bool, reason: str = "", request=None) -> Offer:
    o = by_token(token)
    if o is None:
        raise BusinessRuleError("INVALID_LINK", "This link isn't valid. Use the latest email from us.")
    o = Offer.objects.select_for_update().get(pk=o.pk)
    if o.status == O.EXPIRED:
        raise BusinessRuleError("OFFER_EXPIRED", "This offer has expired. Please contact us.")
    if o.status != O.SENT:
        raise ConflictError("ALREADY_RESPONDED", "This offer has already been answered or withdrawn.")
    c = o.candidate
    if decision == "ACCEPT":
        if " ".join(signed_name.split()).lower() != " ".join(c.name.split()).lower():
            raise BusinessRuleError("NAME_MISMATCH", "Type your full name exactly as it appears on the offer.", field_errors={"signed_name": ["Must match the offer."]})
        if not consent:
            raise BusinessRuleError("CONSENT_REQUIRED", "Tick the box to confirm you accept the terms.")
        o.status, o.signed_name, c.stage = O.ACCEPTED, " ".join(signed_name.split()), C.OFFER_ACCEPTED
    elif decision == "DECLINE":
        o.status, o.decline_reason, c.stage = O.DECLINED, reason.strip()[:500], C.OFFER_DECLINED
    else:
        raise BusinessRuleError("INVALID_DECISION", "Choose accept or decline.")
    o.responded_at, o.response_ip = timezone.now(), _ip_prefix(request)
    o.save()
    c.save(update_fields=["stage", "updated_at"])
    audit(actor=None, action=f"OFFER_{o.status}", entity=o, after={"digest": o.digest}, organization=o.organization)
    word = "accepted" if o.status == O.ACCEPTED else "declined"
    people = list(_hr_and_admins(o.organization))
    notify(people, f"{c.name} {word} the offer", o.decline_reason, "/hr/recruitment", tone="success" if o.status == O.ACCEPTED else "warning")
    for u in people:
        queue_email(template_key="offer", recipient=u.email, subject=f"{c.name} {word} the offer", body=f"{c.name} {word} the offer for {o.designation}." + (f"\nReason: {o.decline_reason}" if o.decline_reason else ""),
                    dedupe_key=f"offer-response:{o.pk}:{u.pk}", organization=o.organization)
    return o
