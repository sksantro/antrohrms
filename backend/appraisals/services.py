"""Appraisal rules (BRD §13). Managers recommend but never see or set salary; only the Super Admin sets the final rating, increment and promotion."""
import re
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User
from attendance.services import policy
from common.errors import BusinessRuleError, ConflictError
from common.services import audit, notify, super_admins
from employees.models import Employee

from .models import Review

S = Review.Status
UNIVERSAL = [("goals", "Goals and achievements this year", True, 2), ("projects", "Project contribution", True, 2), ("skills", "Skills you developed", True, 1),
             ("challenges", "Challenges you faced and how you handled them", False, 0), ("objectives", "Your objectives for next year", False, 0)]
ROLE = {
    "DEVELOPER": ("Developer", [("code_quality", "Code quality and reviews", 2), ("delivery", "Delivery on commitments", 2), ("problem_solving", "Problem solving", 1), ("collaboration", "Collaboration", 1)]),
    "SALES": ("Sales", [("targets", "Targets achieved", 3), ("pipeline", "Pipeline building", 1), ("client_relationships", "Client relationships", 1)]),
    "PRESALES": ("Pre-sales", [("demos", "Demos and presentations", 2), ("solutioning", "Solution design", 2), ("product_knowledge", "Product knowledge", 1)]),
    "DESIGN": ("Design", [("design_quality", "Design quality", 2), ("ux_research", "User research", 1), ("collaboration", "Collaboration with engineering", 1)]),
    "HR": ("HR", [("hiring", "Hiring and onboarding", 2), ("employee_experience", "Employee experience", 1), ("compliance", "Policy and compliance", 1)]),
    "GENERAL": ("General", [("role_skills", "Role skills", 2), ("ownership", "Ownership", 1), ("teamwork", "Teamwork", 1)]),
}
ACTIVE = (Employee.Status.PROBATION, Employee.Status.ACTIVE_CONFIRMED)


def today() -> date:
    return timezone.localdate()


def template_for(designation: str) -> str:
    """Role question group from the designation; anything unmatched gets the General group."""
    d = " " + re.sub(r"[^a-z]+", " ", designation.lower()) + " "
    for code, keys in (("PRESALES", ("pre sales", "presales")), ("SALES", (" sales", "business development")), ("DESIGN", ("design", " ui ", " ux ")),
                       ("HR", (" hr ", "human resource", "talent", "recruit")), ("DEVELOPER", ("developer", "engineer", "programmer", "devops", " qa ", "tester"))):
        if any(k in d for k in keys):
            return code
    return "GENERAL"


def questions(code: str) -> list[dict]:
    qs = [{"key": k, "group": "Universal", "text": t, "rated": r, "weight": w} for k, t, r, w in UNIVERSAL]
    name, items = ROLE[code]
    return qs + [{"key": f"{code.lower()}_{k}", "group": name, "text": t, "rated": True, "weight": w} for k, t, w in items]


def anniversary(emp: Employee, year: int) -> date:
    try:
        return emp.start_date.replace(year=year)
    except ValueError:  # 29 Feb
        return date(year, 2, 28)


def next_due(emp: Employee) -> date:
    t = today()
    d = anniversary(emp, t.year)
    return d if d >= t - timedelta(days=60) else anniversary(emp, t.year + 1)


def _open(emp: Employee, due: date, actor=None) -> Review:
    code = template_for(emp.designation)
    r = Review.objects.create(organization=emp.organization, employee=emp, manager=emp.reporting_manager, cycle_year=due.year, due_date=due, opened_on=today(),
                              template_code=code, questions=questions(code))
    audit(actor=actor, action="APPRAISAL_OPENED", entity=r, after={"cycle": due.year, "due": str(due)}, organization=emp.organization)
    notify(emp.user, "Your annual review is open", f"Submit your self review by {due:%d %b %Y}.", "/app/appraisal")
    return r


def ensure(org) -> None:
    """Open self reviews 30 days (policy appraisal.open_days) before each joining anniversary. First review after a full year."""
    days = int(policy(org, "appraisal.open_days", 30))
    t = today()
    for e in Employee.objects.filter(organization=org, status__in=ACTIVE):
        due = next_due(e)
        if due - timedelta(days=days) <= t and due >= anniversary(e, e.start_date.year + 1) and not Review.objects.filter(employee=e, cycle_year=due.year).exists():
            _open(e, due)


def start_now(emp: Employee, actor, request=None) -> Review:
    """Super Admin can open the next review early (for example, a new joiner's first cycle or a catch-up)."""
    if emp.status not in ACTIVE:
        raise BusinessRuleError("NOT_ELIGIBLE", "Reviews are for current employees, not those on notice or exited.")
    due = next_due(emp)
    if Review.objects.filter(employee=emp, cycle_year=due.year).exists():
        raise ConflictError("REVIEW_EXISTS", f"The {due.year} review already exists.")
    return _open(emp, due, actor)


def score(qs: list[dict], answers: list[dict]) -> Decimal | None:
    w = {q["key"]: Decimal(q["weight"]) for q in qs if q["rated"]}
    num = den = Decimal(0)
    for a in answers:
        if a["key"] in w and a.get("rating"):
            num += w[a["key"]] * Decimal(a["rating"])
            den += w[a["key"]]
    return (num / den).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if den else None


def _clean(r: Review, answers: list[dict], complete: bool, who: str) -> list[dict]:
    qs = {q["key"]: q for q in r.questions}
    got = {}
    for a in answers or []:
        q = qs.get(a.get("key"))
        if not q:
            continue
        rating = a.get("rating")
        if rating is not None and (not q["rated"] or rating not in (1, 2, 3, 4, 5)):
            raise BusinessRuleError("INVALID_RATING", f"“{q['text']}”: rating must be 1 to 5, or N/A.")
        got[q["key"]] = {"key": q["key"], "rating": rating if q["rated"] else None, "text": str(a.get("text", "")).strip()[:3000]}
    if complete:
        for q in r.questions:
            a = got.get(q["key"])
            if q["rated"]:
                if not a:
                    raise BusinessRuleError("ANSWER_REQUIRED", f"Rate “{q['text']}” (or mark it N/A).")
                if a["rating"] and len(a["text"]) < 10:
                    raise BusinessRuleError("JUSTIFICATION_REQUIRED", f"Justify the score for “{q['text']}” (at least 10 characters).")
            elif who == "self" and (not a or len(a["text"]) < 10):
                raise BusinessRuleError("ANSWER_REQUIRED", f"Answer “{q['text']}” (at least 10 characters).")
        if score(r.questions, list(got.values())) is None:
            raise BusinessRuleError("NOTHING_RATED", "Rate at least one question.")
    return [got[q["key"]] for q in r.questions if q["key"] in got]


# ---------- employee ----------
@transaction.atomic
def save_self(r: Review, emp: Employee, answers: list[dict], submit: bool, request=None) -> Review:
    r = Review.objects.select_for_update().get(pk=r.pk)
    if r.employee_id != emp.pk:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if r.status != S.OPEN:
        raise ConflictError("SELF_LOCKED", "Your self review is already submitted.")
    r.self_answers = _clean(r, answers, submit, "self")
    r.self_score = score(r.questions, r.self_answers)
    if submit:
        r.status, r.self_submitted_at = S.SELF_SUBMITTED, timezone.now()
        if r.manager_id is None and r.employee.reporting_manager_id:
            r.manager_id = r.employee.reporting_manager_id
    r.save()
    if submit:
        audit(actor=emp.user, action="SELF_REVIEW_SUBMITTED", entity=r, after={"score": str(r.self_score)}, request=request)
        to = [r.manager.user] if r.manager else list(super_admins(r.organization))
        notify(to, f"Review {emp.display_name}", "Self review submitted. Rate it and hold the discussion.", "/manager/reviews")
    return r


def attach(r: Review, emp: Employee, f, request=None) -> Review:
    from common.files import store
    if r.employee_id != emp.pk:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if r.status != S.OPEN:
        raise ConflictError("SELF_LOCKED", "Attachments close when you submit.")
    if r.attachments.count() >= 3:
        raise BusinessRuleError("TOO_MANY_FILES", "Up to 3 attachments.")
    r.attachments.add(store(f, r.organization, emp.user, allowed=("pdf", "png", "jpg", "docx")))
    return r


@transaction.atomic
def acknowledge(r: Review, emp: Employee, comments: str, request=None) -> Review:
    r = Review.objects.select_for_update().get(pk=r.pk)
    if r.employee_id != emp.pk:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if not r.meeting_date or r.employee_ack_at or r.status != S.SELF_SUBMITTED:
        raise ConflictError("NOTHING_TO_ACKNOWLEDGE", "There's no discussion record waiting for you.")
    r.employee_comments, r.employee_ack_at = comments.strip()[:3000], timezone.now()
    r.save(update_fields=["employee_comments", "employee_ack_at", "updated_at"])
    audit(actor=emp.user, action="APPRAISAL_DISCUSSION_ACKNOWLEDGED", entity=r, request=request)
    if r.manager:
        notify(r.manager.user, f"{emp.display_name} acknowledged the discussion", "You can complete the evaluation now.", "/manager/reviews")
    return r


# ---------- manager ----------
def can_manage(r: Review, user: User) -> bool:
    emp = getattr(user, "employee", None)
    return (r.manager_id is not None and emp is not None and r.manager_id == emp.pk) or (r.manager_id is None and user.has_role(Role.SUPER_ADMIN))


def _mgr(r: Review, user: User) -> Review:
    r = Review.objects.select_for_update().get(pk=r.pk)
    if not can_manage(r, user):
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    if r.status != S.SELF_SUBMITTED:
        raise ConflictError("NOT_WITH_MANAGER", "This review isn't waiting for the manager." if r.status != S.OPEN else "The self review isn't submitted yet.")
    return r


@transaction.atomic
def save_manager(r: Review, user: User, *, answers: list[dict], comments: str, recommendation: str, recommendation_note: str, request=None) -> Review:
    r = _mgr(r, user)
    if recommendation not in ("NONE", "INCREMENT", "PROMOTION", "BOTH"):
        raise BusinessRuleError("INVALID_RECOMMENDATION", "Choose a recommendation.")
    r.manager_answers = _clean(r, answers, False, "manager")
    r.manager_score = score(r.questions, r.manager_answers)
    r.manager_comments, r.recommendation, r.recommendation_note = comments.strip(), recommendation, recommendation_note.strip()[:500]
    r.save()
    return r


@transaction.atomic
def record_meeting(r: Review, user: User, *, meeting_date: date, strengths: str, development_plan: str, disagreements: str = "", request=None) -> Review:
    r = _mgr(r, user)
    if meeting_date > today():
        raise BusinessRuleError("MEETING_IN_FUTURE", "Record the discussion after it happens.")
    if r.self_submitted_at and meeting_date < timezone.localtime(r.self_submitted_at).date():
        raise BusinessRuleError("MEETING_TOO_EARLY", "The discussion must be after the self review was submitted.")
    if len(strengths.strip()) < 10 or len(development_plan.strip()) < 10:
        raise BusinessRuleError("MEETING_DETAILS_REQUIRED", "Write the key strengths and the development plan (at least 10 characters each).")
    r.meeting_date, r.strengths, r.development_plan, r.disagreements = meeting_date, strengths.strip(), development_plan.strip(), disagreements.strip()
    r.employee_ack_at, r.employee_comments = None, ""  # a changed record needs a fresh acknowledgement
    r.save()
    audit(actor=user, action="APPRAISAL_DISCUSSION_RECORDED", entity=r, after={"date": str(meeting_date)}, request=request)
    notify(r.employee.user, "Please acknowledge your review discussion", "", "/app/appraisal")
    return r


@transaction.atomic
def complete(r: Review, user: User, request=None) -> Review:
    r = _mgr(r, user)
    _clean(r, r.manager_answers, True, "manager")
    if len(r.manager_comments) < 10:
        raise BusinessRuleError("COMMENTS_REQUIRED", "Add overall comments (at least 10 characters).")
    if not r.meeting_date:
        raise BusinessRuleError("MEETING_REQUIRED", "Record the discussion with the employee first. It's mandatory.")
    if not r.employee_ack_at:
        raise BusinessRuleError("ACK_REQUIRED", "The employee must acknowledge the discussion record first.")
    r.status, r.manager_completed_at, r.admin_note = S.MANAGER_COMPLETED, timezone.now(), ""
    r.save()
    audit(actor=user, action="APPRAISAL_EVALUATION_COMPLETED", entity=r, after={"manager_score": str(r.manager_score), "recommendation": r.recommendation}, request=request)
    notify(list(super_admins(r.organization)), f"Appraisal to finalise: {r.employee.display_name}", f"Recommendation: {r.recommendation.lower()}", "/console/appraisals")
    return r


# ---------- Super Admin ----------
def _scaled(components: list[dict], old: Decimal, new: Decimal) -> list[dict]:
    """New earnings in the same proportions; deductions unchanged; rounding goes to the last earning so the total is exact."""
    earn = [c for c in components if c["type"] == "EARNING"]
    if not earn or old <= 0:
        return [{"code": "BASIC", "name": "Basic", "type": "EARNING", "amount": str(new)}] + [c for c in components if c["type"] != "EARNING"]
    out, total = [], Decimal(0)
    for i, c in enumerate(earn):
        amt = (new - total) if i == len(earn) - 1 else (Decimal(c["amount"]) * new / old).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total += amt
        out.append({**c, "amount": str(amt)})
    return out + [c for c in components if c["type"] != "EARNING"]


def apply_due_promotions(org) -> None:
    for r in Review.objects.filter(organization=org, status=S.APPROVED, promotion_applied=False).exclude(new_designation="").filter(effective_date__lte=today()):
        e = r.employee
        before = e.designation
        e.designation = r.new_designation
        e.save(update_fields=["designation", "updated_at"])  # access rules sync on save (designation-based roles)
        r.promotion_applied = True
        r.save(update_fields=["promotion_applied"])
        audit(actor=r.approved_by, action="PROMOTION_APPLIED", entity=e, before={"designation": before}, after={"designation": e.designation}, organization=org)


@transaction.atomic
def decide(r: Review, actor, decision: str, *, note: str = "", final_rating=None, new_gross=None, new_designation: str = "", effective_date: date | None = None, request=None) -> Review:
    from onboarding import letters
    from payroll.models import SalaryVersion
    from payroll.services import is_locked
    r = Review.objects.select_for_update().get(pk=r.pk)
    if r.status != S.MANAGER_COMPLETED:
        raise ConflictError("NOT_PENDING", "This review isn't waiting for your decision.")
    note = note.strip()
    if decision == "SEND_BACK":
        if len(note) < 3:
            raise BusinessRuleError("NOTE_REQUIRED", "Tell the manager what to revisit.")
        r.status, r.admin_note, r.manager_completed_at = S.SELF_SUBMITTED, note, None
        r.save()
        audit(actor=actor, action="APPRAISAL_SENT_BACK", entity=r, reason=note, request=request)
        if r.manager:
            notify(r.manager.user, f"Review of {r.employee.display_name} sent back", note, "/manager/reviews", tone="warning")
        return r
    if decision != "APPROVE":
        raise BusinessRuleError("INVALID_DECISION", "Approve or send back.")
    try:
        rating = Decimal(str(final_rating)).quantize(Decimal("0.1"))
    except Exception:
        rating = None
    if rating is None or not (Decimal(1) <= rating <= Decimal(5)):
        raise BusinessRuleError("RATING_REQUIRED", "Set the final rating (1.0 to 5.0).", field_errors={"final_rating": ["1 to 5."]})
    emp = r.employee
    gross = None
    if new_gross not in (None, ""):
        try:
            gross = Decimal(str(new_gross)).quantize(Decimal("0.01"))
        except Exception:
            raise BusinessRuleError("INVALID_AMOUNT", "The new salary must be a number.")
    designation = new_designation.strip()
    if (gross is not None or designation) and effective_date is None:
        raise BusinessRuleError("EFFECTIVE_DATE_REQUIRED", "Pick the effective date for the change.", field_errors={"effective_date": ["Required."]})
    if effective_date and effective_date < today():
        raise BusinessRuleError("EFFECTIVE_IN_PAST", "Changes take effect today or later; past corrections go through payroll adjustments.")
    sv = None
    if gross is not None:
        cur = emp.salary_versions.filter(effective_from__lte=effective_date).order_by("-effective_from").first()
        if cur is None:
            raise BusinessRuleError("NO_SALARY", "This employee has no salary on record to revise.")
        if gross <= cur.monthly_gross:
            raise BusinessRuleError("NOT_AN_INCREMENT", f"The new salary must be above the current {cur.monthly_gross:,.2f}.")
        if is_locked(emp.organization, effective_date.year, effective_date.month):
            raise BusinessRuleError("PAYROLL_LOCKED", "Payroll for that month is already approved. Pick a later effective date.")
        if SalaryVersion.objects.filter(employee=emp, effective_from=effective_date).exists():
            raise ConflictError("EFFECTIVE_DATE_COLLISION", "A salary version already starts on that date.")
        sv = SalaryVersion.objects.create(employee=emp, effective_from=effective_date, monthly_gross=gross, components=_scaled(cur.components, cur.monthly_gross, gross),
                                          note=f"Appraisal {r.cycle_year}", created_by=actor)
        audit(actor=actor, action="SALARY_VERSION_CREATED", entity=sv, after={"employee_id": str(emp.pk), "effective_from": str(effective_date), "source": "appraisal"}, request=request, organization=emp.organization)
    if designation and designation == emp.designation:
        raise BusinessRuleError("SAME_DESIGNATION", "That's the current designation.")
    r.final_rating, r.new_designation, r.effective_date, r.salary_version = rating, designation, effective_date if (sv or designation) else None, sv
    r.status, r.admin_note, r.approved_by, r.approved_at = S.APPROVED, note, actor, timezone.now()
    r.save()
    audit(actor=actor, action="APPRAISAL_APPROVED", entity=r, after={"final_rating": str(rating), "increment": bool(sv), "promotion": bool(designation)}, request=request)
    apply_due_promotions(emp.organization)
    if sv:
        lt = letters.draft(emp, "SALARY_REVISION", actor, ctx={"salary_version_id": str(sv.pk)}, source=f"appraisal:{r.pk}", request=request)
        lt.status = letters.L.PENDING_ADMIN
        lt.save(update_fields=["status"])
        letters.release(lt, actor, request)
    parts = [f"final rating {rating}"] + ([f"new designation {designation} from {effective_date:%d %b %Y}"] if designation else []) + (["salary revision letter in Documents"] if sv else [])
    notify(emp.user, "Your annual review is complete", "; ".join(parts).capitalize() + ".", "/app/appraisal", tone="success")
    hr = list(User.objects.filter(organization=emp.organization, is_active=True, role_assignments__role=Role.HR_OPERATIONS).distinct())
    notify(hr + ([r.manager.user] if r.manager else []), f"Appraisal completed: {emp.display_name}", "", "/hr/appraisals")  # status only, no amounts
    return r
