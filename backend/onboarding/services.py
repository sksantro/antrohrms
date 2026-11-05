"""Preboarding portal, document checks, Mark Joined and probation (BRD §3.3, §10.1, §10.2)."""
import hashlib
import secrets
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from accounts.models import Role, User
from attendance.services import policy
from common.errors import BusinessRuleError, ConflictError
from common.services import audit, notify, queue_email, super_admins
from employees.models import Employee, add_months
from employees.services import create_employee
from recruitment.models import Candidate, Offer

from . import letters
from .models import CandidateDocument, DocumentRequest, Onboarding, ProbationReview

D = CandidateDocument.Status
# Never Aadhaar, PAN or bank details: the company does not store them (privacy rule).
CATEGORIES = {
    "EDUCATION": "Highest education certificate",
    "EXPERIENCE": "Experience or relieving letter from last employer",
    "PAYSLIPS": "Last 3 months' payslips from last employer",
    "PHOTO": "Passport-size photo",
    "ADDRESS": "Address proof (not Aadhaar)",
    "OTHER": "Other document",
}
CHECKLIST = [("documents", "Documents verified"), ("workstation", "Desk and equipment ready"), ("email", "Company email created"),
             ("induction", "Induction scheduled"), ("buddy", "Buddy or manager informed")]
class WrongCode(BusinessRuleError):
    """Returned by the view as a normal response, so the request isn't rolled back and the failed try stays counted."""


LINK_DAYS, OTP_MIN, OTP_TRIES, OTP_PER_HOUR, SESSION_HOURS = 7, 10, 5, 5, 24


def _h(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def mask(email: str) -> str:
    name, _, dom = email.partition("@")
    return f"{name[:2]}{'•' * max(1, len(name) - 2)}@{dom}"


def onboarding_for(c: Candidate) -> Onboarding:
    ob, _ = Onboarding.objects.get_or_create(candidate=c, defaults={"organization": c.organization,
                                                                    "checklist": [{"key": k, "label": lb, "done": False} for k, lb in CHECKLIST]})
    return ob


def accepted_offer(c: Candidate) -> Offer:
    o = c.offers.filter(status=Offer.Status.ACCEPTED).first()
    if o is None or c.stage != Candidate.Stage.OFFER_ACCEPTED:
        raise BusinessRuleError("OFFER_NOT_ACCEPTED", "The candidate must accept the offer first.")
    return o


# ---------- HR: request documents ----------
@transaction.atomic
def request_documents(c: Candidate, actor, categories: list[str], web_base: str, request=None) -> DocumentRequest:
    accepted_offer(c)
    cats = [x for x in dict.fromkeys(categories) if x in CATEGORIES]
    if not cats:
        raise BusinessRuleError("CATEGORIES_REQUIRED", "Pick at least one document to request.")
    token = secrets.token_urlsafe(32)
    dr = DocumentRequest.objects.filter(candidate=c).first()
    if dr is None:
        dr = DocumentRequest(organization=c.organization, candidate=c, created_by=actor)
    dr.categories, dr.open, dr.token_hash = cats, True, _h(token)
    dr.link_expires_at, dr.link_used_at = timezone.now() + timedelta(days=LINK_DAYS), None
    dr.otp_hash, dr.otp_attempts, dr.session_hash, dr.session_expires_at = "", 0, "", None
    dr.save()
    onboarding_for(c)
    audit(actor=actor, action="DOCUMENTS_REQUESTED", entity=c, after={"categories": cats}, request=request)
    org = c.organization
    queue_email(template_key="preboarding", recipient=c.email, subject=f"Documents for joining {org.legal_name}",
                body=f"Dear {c.name},\n\nPlease upload these documents before you join:\n" + "\n".join(f"• {CATEGORIES[x]}" for x in cats)
                     + f"\n\nOpen this personal link (valid {LINK_DAYS} days, works once): {web_base}/candidate/documents/{token}\n"
                     "We'll email you a one-time code to confirm it's you.\n\nWe never ask for Aadhaar, PAN or bank details here.\n\n" + org.legal_name,
                dedupe_key=f"docs-link:{dr.pk}:{dr.token_hash[:12]}", organization=org)
    return dr


# ---------- candidate portal ----------
def _by_link(token: str) -> DocumentRequest:
    dr = DocumentRequest.objects.select_for_update().filter(token_hash=_h(token or "")).select_related("candidate").first() if token and len(token) < 100 else None
    if dr is None or not dr.open:
        raise BusinessRuleError("INVALID_LINK", "This link isn't valid any more. Ask HR to send a new one.")
    if dr.link_used_at:
        raise BusinessRuleError("LINK_USED", "This link was already used. Ask HR to send a new one if you need to upload again.")
    if dr.link_expires_at < timezone.now():
        raise BusinessRuleError("LINK_EXPIRED", "This link has expired. Ask HR to send a new one.")
    if dr.candidate.stage != Candidate.Stage.OFFER_ACCEPTED:
        raise BusinessRuleError("INVALID_LINK", "This link isn't valid any more.")
    return dr


@transaction.atomic
def send_otp(token: str) -> dict:
    dr = _by_link(token)
    now = timezone.now()
    recent = [t for t in dr.otp_sent if parse_datetime(t) and parse_datetime(t) > now - timedelta(hours=1)]
    if len(recent) >= OTP_PER_HOUR:
        raise BusinessRuleError("OTP_LIMIT", "Too many codes requested. Try again in an hour.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    dr.otp_hash, dr.otp_expires_at, dr.otp_attempts, dr.otp_sent = _h(f"{dr.pk}:{code}"), now + timedelta(minutes=OTP_MIN), 0, [*recent, now.isoformat()]
    dr.save()
    c = dr.candidate
    queue_email(template_key="otp", recipient=c.email, subject=f"Your code: {code}", body=f"Your one-time code is {code}. It expires in {OTP_MIN} minutes. Don't share it with anyone.",
                dedupe_key=f"otp:{dr.pk}:{now.timestamp()}", organization=c.organization)
    return {"sent_to": mask(c.email), "expires_in_min": OTP_MIN}


def verify_otp(token: str, code: str) -> str:
    """A wrong code is counted even though an error is returned (see WrongCode)."""
    with transaction.atomic():
        dr = _by_link(token)
        if not dr.otp_hash or not dr.otp_expires_at or dr.otp_expires_at < timezone.now():
            raise BusinessRuleError("OTP_EXPIRED", "The code has expired. Request a new one.")
        if dr.otp_attempts >= OTP_TRIES:
            raise BusinessRuleError("OTP_LOCKED", "Too many wrong codes. Request a new one.")
        if secrets.compare_digest(dr.otp_hash, _h(f"{dr.pk}:{(code or '').strip()}")):
            session = secrets.token_urlsafe(32)
            dr.link_used_at, dr.otp_hash = timezone.now(), ""
            dr.session_hash, dr.session_expires_at = _h(session), timezone.now() + timedelta(hours=SESSION_HOURS)
            dr.save()
            audit(actor=None, action="PORTAL_VERIFIED", entity=dr.candidate, organization=dr.organization)
            return session
        dr.otp_attempts += 1
        dr.save(update_fields=["otp_attempts"])
        left = OTP_TRIES - dr.otp_attempts
    raise WrongCode("OTP_WRONG", f"That code is wrong. {left} tr{'y' if left == 1 else 'ies'} left." if left else "Too many wrong codes. Request a new one.")


def by_session(session: str) -> DocumentRequest:
    dr = DocumentRequest.objects.filter(session_hash=_h(session)).select_related("candidate").first() if session and len(session) < 100 else None
    if dr is None or not dr.open or not dr.session_expires_at or dr.session_expires_at < timezone.now() or dr.candidate.stage != Candidate.Stage.OFFER_ACCEPTED:
        raise BusinessRuleError("SESSION_EXPIRED", "Your session has ended. Ask HR for a new link.")
    return dr


@transaction.atomic
def upload(dr: DocumentRequest, category: str, f) -> CandidateDocument:
    from common.files import store
    if category not in dr.categories:
        raise BusinessRuleError("NOT_REQUESTED", "That document wasn't requested.")
    cur = CandidateDocument.objects.select_for_update().filter(candidate=dr.candidate, category=category, superseded=False).first()
    if cur and cur.status == D.VERIFIED:
        raise ConflictError("ALREADY_VERIFIED", "HR already verified this document.")
    stored = store(f, dr.organization, None, allowed=("pdf", "png", "jpg"))
    if cur:
        cur.superseded = True
        cur.save(update_fields=["superseded"])
    doc = CandidateDocument.objects.create(organization=dr.organization, candidate=dr.candidate, category=category, file=stored)
    audit(actor=None, action="DOCUMENT_UPLOADED", entity=dr.candidate, after={"category": category, "sha256": stored.sha256}, organization=dr.organization)
    hr = User.objects.filter(organization=dr.organization, is_active=True, role_assignments__role=Role.HR_OPERATIONS).distinct()
    notify(list(hr) or list(super_admins(dr.organization)), f"{dr.candidate.name} uploaded: {CATEGORIES[category]}", "", "/hr/onboarding")
    return doc


# ---------- HR: review ----------
@transaction.atomic
def review(doc: CandidateDocument, actor, status: str, note: str, request=None) -> CandidateDocument:
    doc = CandidateDocument.objects.select_for_update().get(pk=doc.pk)
    if doc.superseded:
        raise ConflictError("SUPERSEDED", "A newer upload replaced this one.")
    if status not in (D.RECEIVED, D.NEEDS_REUPLOAD, D.VERIFIED):
        raise BusinessRuleError("INVALID_STATUS", "Mark it received, verified or needs re-upload.")
    if doc.candidate.stage == Candidate.Stage.JOINED:
        raise ConflictError("ALREADY_JOINED", "This person has joined; their documents are closed.")
    if status == D.NEEDS_REUPLOAD and len(note.strip()) < 5:
        raise BusinessRuleError("NOTE_REQUIRED", "Tell the candidate what's wrong (at least 5 characters).", field_errors={"note": ["Required."]})
    doc.status, doc.hr_note, doc.reviewed_by, doc.reviewed_at = status, note.strip()[:300], actor, timezone.now()
    doc.save()
    audit(actor=actor, action=f"DOCUMENT_{status}", entity=doc.candidate, after={"category": doc.category}, reason=note, request=request)
    if status == D.NEEDS_REUPLOAD:
        c = doc.candidate
        queue_email(template_key="preboarding", recipient=c.email, subject="Please upload a document again",
                    body=f"Dear {c.name},\n\nPlease upload your {CATEGORIES[doc.category].lower()} again: {doc.hr_note}\n\nUse your document link; if it has expired, HR will send a new one.",
                    dedupe_key=f"reupload:{doc.pk}", organization=c.organization)
    return doc


def missing(c: Candidate) -> list[str]:
    dr = getattr(c, "document_request", None)
    if dr is None:
        return ["Documents haven't been requested"]
    verified = set(CandidateDocument.objects.filter(candidate=c, superseded=False, status=D.VERIFIED).values_list("category", flat=True))
    return [CATEGORIES[x] for x in dr.categories if x not in verified]


def set_check(c: Candidate, actor, key: str, done: bool, request=None) -> Onboarding:
    ob = onboarding_for(c)
    if ob.joined_at and key == "documents":
        raise ConflictError("ALREADY_JOINED", "Already joined.")
    if key not in {k for k, _ in CHECKLIST}:
        raise BusinessRuleError("INVALID_ITEM", "Unknown checklist item.")
    if key == "documents" and done and missing(c):
        raise BusinessRuleError("MISSING_DOCUMENTS", f"Not verified yet: {', '.join(missing(c))}.")
    ob.checklist = [{**i, "done": done, "by": actor.display_name if done else "", "at": timezone.now().isoformat() if done else ""} if i["key"] == key else i for i in ob.checklist]
    ob.save(update_fields=["checklist"])
    audit(actor=actor, action="ONBOARDING_CHECK", entity=c, after={"item": key, "done": done}, request=request)
    return ob


# ---------- Mark Joined ----------
def default_components(org, gross: Decimal) -> list[dict]:
    """Default split for a new salary (BRD §8.1 example): Basic 50%, HRA 20%, Special Allowance the rest. Editable later by the Super Admin."""
    split = policy(org, "payroll.default_split", {"BASIC": 50, "HRA": 20})
    q = lambda x: (gross * Decimal(x) / 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)  # noqa: E731
    basic, hra = q(split["BASIC"]), q(split["HRA"])
    return [{"code": "BASIC", "name": "Basic", "type": "EARNING", "amount": str(basic)},
            {"code": "HRA", "name": "House Rent Allowance", "type": "EARNING", "amount": str(hra)},
            {"code": "SPECIAL", "name": "Special Allowance", "type": "EARNING", "amount": str(gross - basic - hra)}]


@transaction.atomic
def mark_joined(c: Candidate, actor, official_email: str, request=None) -> Employee:
    from payroll.models import SalaryVersion
    c = Candidate.objects.select_for_update().get(pk=c.pk)
    if c.stage == Candidate.Stage.JOINED:
        raise ConflictError("ALREADY_JOINED", "This candidate has already joined.")
    o = accepted_offer(c)
    gaps = missing(c)
    if gaps:
        raise BusinessRuleError("MISSING_DOCUMENTS", f"Verify these first: {', '.join(gaps)}.")
    today = timezone.localdate()
    if o.joining_date > today:
        raise BusinessRuleError("NOT_JOINING_YET", f"The joining date is {o.joining_date:%d %b %Y}. Mark Joined on or after that day.")
    if (today - o.joining_date).days > 30:
        raise BusinessRuleError("JOINING_DATE_OLD", "The joining date is more than 30 days ago. Ask the Super Admin to update the offer.")
    email = official_email.strip().lower()
    if "@" not in email:
        raise BusinessRuleError("INVALID_EMAIL", "Enter the new company email.", field_errors={"official_email": ["Required."]})
    if email == c.email.lower():
        raise BusinessRuleError("PERSONAL_EMAIL", "Use the company email, not the candidate's personal one.", field_errors={"official_email": ["Company email."]})
    emp, _ = create_employee(actor=actor, request=request, roles=[], data={
        "official_email": email, "display_name": c.name, "phone": c.phone, "department": o.department, "designation": o.designation,
        "reporting_manager": o.reporting_manager, "employment_type": o.employment_type, "start_date": o.joining_date,
        "probation_months": int(policy(c.organization, "employees.probation_months", 3)), "status": Employee.Status.PROBATION})
    sv = SalaryVersion.objects.create(employee=emp, effective_from=o.joining_date, monthly_gross=o.monthly_gross, components=default_components(c.organization, o.monthly_gross),
                                      note="From the approved offer", created_by=o.approved_by or actor)
    c.stage = Candidate.Stage.JOINED
    c.save(update_fields=["stage", "updated_at"])
    DocumentRequest.objects.filter(candidate=c).update(open=False, session_hash="")  # portal access ends at conversion
    CandidateDocument.objects.filter(candidate=c).update(employee=emp)
    ob = onboarding_for(c)
    ob.employee, ob.joined_at, ob.joined_by = emp, timezone.now(), actor
    ob.save()
    audit(actor=actor, action="MARKED_JOINED", entity=emp, after={"candidate_id": str(c.pk), "code": emp.employee_code}, request=request)
    audit(actor=actor, action="SALARY_VERSION_CREATED", entity=sv, after={"employee_id": str(emp.pk), "effective_from": str(sv.effective_from), "source": "offer"}, request=request, organization=c.organization)
    lt = letters.draft(emp, "APPOINTMENT", actor, source=f"join:{c.pk}", request=request)
    letters.submit(lt, actor, request)
    return emp


# ---------- probation ----------
def due(org, within_days: int | None = None) -> list[Employee]:
    within = within_days if within_days is not None else int(policy(org, "employees.probation_reminder_days", 15))
    limit = timezone.localdate() + timedelta(days=within)
    open_ids = set(ProbationReview.objects.filter(organization=org, status="PENDING_ADMIN").values_list("employee_id", flat=True))
    return [e for e in Employee.objects.filter(organization=org, status=Employee.Status.PROBATION).select_related("department") if e.probation_end <= limit and e.pk not in open_ids]


@transaction.atomic
def start_review(emp: Employee, actor, recommendation: str, note: str, extend_months: int = 0, request=None) -> ProbationReview:
    emp = Employee.objects.select_for_update().get(pk=emp.pk)
    if emp.status != Employee.Status.PROBATION:
        raise ConflictError("NOT_ON_PROBATION", "This employee isn't on probation.")
    if ProbationReview.objects.filter(employee=emp, status="PENDING_ADMIN").exists():
        raise ConflictError("REVIEW_OPEN", "A review is already waiting for the Super Admin.")
    if recommendation not in ("CONFIRM", "EXTEND"):
        raise BusinessRuleError("INVALID_RECOMMENDATION", "Recommend confirm or extend.")
    if recommendation == "EXTEND" and not (1 <= extend_months <= 3):
        raise BusinessRuleError("INVALID_EXTENSION", "Extend by 1 to 3 months.")
    if len(note.strip()) < 10:
        raise BusinessRuleError("NOTE_REQUIRED", "Summarise the review (at least 10 characters).", field_errors={"note": ["Required."]})
    if emp.probation_end > timezone.localdate() + timedelta(days=30):
        raise BusinessRuleError("TOO_EARLY", f"Probation ends on {emp.probation_end:%d %b %Y}. Start the review within 30 days of that.")
    r = ProbationReview.objects.create(organization=emp.organization, employee=emp, due_on=emp.probation_end, recommendation=recommendation,
                                       extend_months=extend_months if recommendation == "EXTEND" else 0, hr_note=note.strip(), created_by=actor)
    audit(actor=actor, action="PROBATION_REVIEW_STARTED", entity=emp, after={"recommendation": recommendation}, request=request)
    notify(list(super_admins(emp.organization)), f"Probation decision: {emp.display_name}", f"HR recommends: {recommendation.lower()}", "/console/letters")
    return r


@transaction.atomic
def decide_probation(r: ProbationReview, actor, decision: str, note: str, extend_months: int = 0, request=None) -> ProbationReview:
    r = ProbationReview.objects.select_for_update().get(pk=r.pk)
    if r.status != "PENDING_ADMIN":
        raise ConflictError("NOT_PENDING", "This review is already decided.")
    emp = Employee.objects.select_for_update().get(pk=r.employee_id)
    if decision == "CONFIRM":
        emp.status = Employee.Status.ACTIVE_CONFIRMED
        emp.save(update_fields=["status", "updated_at"])
        r.status, kind, ctx = "CONFIRMED", "PROBATION_CONFIRMATION", {}
    elif decision == "EXTEND":
        if not (1 <= extend_months <= 3):
            raise BusinessRuleError("INVALID_EXTENSION", "Extend by 1 to 3 months.")
        if len(note.strip()) < 3:
            raise BusinessRuleError("NOTE_REQUIRED", "Add a note explaining the extension.")
        emp.probation_months += extend_months
        emp.save(update_fields=["probation_months", "updated_at"])
        r.status, r.extend_months, kind = "EXTENDED", extend_months, "PROBATION_EXTENSION"
        ctx = {"probation.new_end_date": f"{add_months(emp.start_date, emp.probation_months):%d %B %Y}"}
    else:
        raise BusinessRuleError("INVALID_DECISION", "Confirm or extend.")
    r.admin_note, r.decided_by, r.decided_at = note.strip(), actor, timezone.now()
    r.save()
    audit(actor=actor, action=f"PROBATION_{r.status}", entity=emp, reason=note, request=request)
    # The Super Admin's decision is the approval of the letter, so it is released straight away (BRD §3.3).
    lt = letters.draft(emp, kind, actor, ctx=ctx, source=f"probation:{r.pk}", request=request)
    lt.status = letters.L.PENDING_ADMIN
    lt.save(update_fields=["status"])
    letters.release(lt, actor, request)
    return r
