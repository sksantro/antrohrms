from django.utils import timezone
from rest_framework import serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsSuperAdmin, IsSuperAdminOrHR
from attendance.views import _employee
from common.errors import BusinessRuleError
from common.files import serve, store
from employees.models import Department, Employee
from employees.services import web_base

from . import services as svc
from .models import Candidate, Feedback, InterviewRound, Offer


def _get(model, request, pk, **scope):
    obj = model.objects.filter(organization=request.user.organization, pk=pk, **scope).first()
    if obj is None:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    return obj


def _person(e: Employee) -> dict:
    return {"id": str(e.id), "display_name": e.display_name, "designation": e.designation}


def _round(r: InterviewRound) -> dict:
    return {"id": str(r.id), "kind": r.kind, "kind_name": r.get_kind_display(), "scheduled_at": r.scheduled_at, "duration_min": r.duration_min, "mode": r.mode,
            "meeting_url": r.meeting_url, "location": r.location, "status": r.status, "reschedules": r.reschedules,
            "interviewers": [_person(e) for e in r.interviewers.all()], "template": {"code": r.template.code, "version": r.template.version, "name": r.template.name}}


def _feedback(fb: Feedback, questions=None) -> dict:
    out = {"id": str(fb.id), "round_id": str(fb.round_id), "interviewer": _person(fb.interviewer), "revision": fb.revision, "answers": fb.answers, "overall": fb.overall,
           "comments": fb.comments, "score": fb.score and float(fb.score), "submitted_at": fb.submitted_at, "amend_reason": fb.amend_reason}
    if questions is not None:
        out["questions"] = questions
    return out


def _offer(o: Offer, admin: bool) -> dict:
    out = {"id": str(o.id), "status": o.status, "designation": o.designation, "department": {"id": str(o.department_id), "name": o.department.name},
           "employment_type": o.employment_type, "joining_date": o.joining_date, "work_location": o.work_location, "terms": o.terms,
           "reporting_manager": _person(o.reporting_manager) if o.reporting_manager else None, "admin_note": o.admin_note, "expires_at": o.expires_at,
           "approved_at": o.approved_at, "responded_at": o.responded_at, "decline_reason": o.decline_reason, "digest": o.digest,
           "letter": (o.letter or svc.render_letter(o, redact=False)) if admin else svc.render_letter(o, redact=True)}
    if admin:
        out["monthly_gross"] = o.monthly_gross
    return out


def _candidate(c: Candidate, user, full=True) -> dict:
    admin = user.has_role(Role.SUPER_ADMIN)
    offer = c.offers.exclude(status="WITHDRAWN").select_related("department", "reporting_manager").first()
    out = {"id": str(c.id), "name": c.name, "email": c.email, "phone": c.phone, "role_applied": c.role_applied, "template_code": c.template_code,
           "department": {"id": str(c.department_id), "name": c.department.name} if c.department else None, "source": c.source, "stage": c.stage,
           "has_resume": bool(c.resume_id), "decision_note": c.decision_note, "created_at": c.created_at, "updated_at": c.updated_at,
           "offer_status": offer.status if offer else None}
    if full:
        fbs = svc.latest_feedback(c)
        out |= {"notes": c.notes, "rounds": [_round(r) for r in c.rounds.prefetch_related("interviewers").select_related("template")],
                "feedback": [_feedback(f) for f in fbs], "avg_score": round(sum(float(f.score) for f in fbs if f.score) / max(1, sum(1 for f in fbs if f.score)), 2) if fbs else None,
                "offer": _offer(offer, admin) if offer else None}
    return out


# ---------- HR: candidates ----------
class CandidateIn(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    role_applied = serializers.CharField(max_length=120)
    department = serializers.UUIDField(required=False, allow_null=True)
    template_code = serializers.ChoiceField(choices=list(svc.DEFAULT_TEMPLATES), default="GENERAL")
    source = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


def _dept(request, pk):
    if not pk:
        return None
    d = Department.objects.filter(organization=request.user.organization, pk=pk).first()
    if d is None:
        raise BusinessRuleError("INVALID_DEPARTMENT", "Pick a department.")
    return d


class CandidatesView(APIView):
    permission_classes = [IsSuperAdminOrHR]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = Candidate.objects.filter(organization=request.user.organization).select_related("department")
        if st := request.query_params.get("stage"):
            qs = qs.filter(stage__in=st.split(","))
        if q := request.query_params.get("q"):
            qs = qs.filter(name__icontains=q) | qs.filter(email__icontains=q) | qs.filter(role_applied__icontains=q)
        return Response({"candidates": [_candidate(c, request.user, full=False) for c in qs[:300]]})

    def post(self, request):
        s = CandidateIn(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        d["department"] = _dept(request, d.get("department"))
        f = request.FILES.get("resume")
        d["resume"] = store(f, request.user.organization, request.user, allowed=("pdf", "docx")) if f else None
        c = svc.create_candidate(request.user.organization, request.user, **d, request=request)
        return Response(_candidate(c, request.user), status=201)


class CandidateView(APIView):
    permission_classes = [IsSuperAdminOrHR]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        return Response(_candidate(_get(Candidate, request, pk), request.user))

    def patch(self, request, pk):
        c = _get(Candidate, request, pk)
        s = CandidateIn(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        d = {k: v for k, v in s.validated_data.items() if k in request.data}
        if "department" in d:
            d["department"] = _dept(request, d["department"])
        if f := request.FILES.get("resume"):
            d["resume"] = store(f, request.user.organization, request.user, allowed=("pdf", "docx"))
        return Response(_candidate(svc.update_candidate(c, request.user, d, request), request.user))


class CandidateWithdrawView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        return Response(_candidate(svc.withdraw(_get(Candidate, request, pk), request.user, str(request.data.get("note", "")), request), request.user))


class ResumeView(APIView):
    """HR, Super Admin, or an interviewer assigned to one of this candidate's rounds."""

    def get(self, request, pk):
        c = _get(Candidate, request, pk)
        emp = getattr(request.user, "employee", None)
        ok = request.user.has_role(Role.SUPER_ADMIN, Role.HR_OPERATIONS) or (emp and c.rounds.filter(interviewers=emp).exists())
        if not ok or not c.resume_id:
            raise BusinessRuleError("NOT_FOUND", "Not found.")
        return serve(c.resume)


# ---------- HR: interviews ----------
class RoundIn(serializers.Serializer):
    kind = serializers.ChoiceField(choices=InterviewRound.Kind.choices)
    scheduled_at = serializers.DateTimeField()
    duration_min = serializers.IntegerField(default=45)
    mode = serializers.ChoiceField(choices=InterviewRound.Mode.choices)
    meeting_url = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    location = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    interviewers = serializers.ListField(child=serializers.UUIDField(), allow_empty=True)


def _round_args(request):
    s = RoundIn(data=request.data)
    s.is_valid(raise_exception=True)
    d = dict(s.validated_data)
    d["interviewers"] = list(Employee.objects.filter(organization=request.user.organization, pk__in=d["interviewers"]))
    return d


class CandidateRoundsView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        r = svc.schedule(_get(Candidate, request, pk), request.user, **_round_args(request), request=request)
        return Response(_round(r), status=201)


class RoundView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def put(self, request, pk):
        d = _round_args(request)
        d.pop("kind")
        return Response(_round(svc.reschedule(_get(InterviewRound, request, pk), request.user, **d, request=request)))


class RoundCancelView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        return Response(_round(svc.cancel_round(_get(InterviewRound, request, pk), request.user, request)))


# ---------- interviewers ----------
class AssignedView(APIView):
    def get(self, request):
        emp = _employee(request)
        rounds = InterviewRound.objects.filter(interviewers=emp).exclude(status="CANCELLED").select_related("candidate", "template").prefetch_related("interviewers")
        mine = {}
        for f in Feedback.objects.filter(interviewer=emp).order_by("round", "-revision"):
            mine.setdefault(f.round_id, f)  # latest revision
        out = []
        for r in rounds.order_by("-scheduled_at")[:100]:
            c, fb = r.candidate, mine.get(r.id)
            out.append({**_round(r), "candidate": {"id": str(c.id), "name": c.name, "role_applied": c.role_applied, "has_resume": bool(c.resume_id), "stage": c.stage},
                        "my_feedback": _feedback(fb) if fb else None, "questions": r.template.questions,
                        "can_submit": r.scheduled_at <= timezone.now() and c.stage in ("INTERVIEWING", "SELECTION_PENDING")})
        return Response({"rounds": out})


class FeedbackIn(serializers.Serializer):
    answers = serializers.ListField(child=serializers.DictField())
    overall = serializers.CharField(required=False, allow_blank=True, default="")
    comments = serializers.CharField(required=False, allow_blank=True, default="")
    submit = serializers.BooleanField(default=False)
    amend_reason = serializers.CharField(required=False, allow_blank=True, default="")


class FeedbackView(APIView):
    def post(self, request, pk):
        s = FeedbackIn(data=request.data)
        s.is_valid(raise_exception=True)
        fb = svc.save_feedback(_get(InterviewRound, request, pk), _employee(request), **s.validated_data, request=request)
        return Response(_feedback(fb))


# ---------- HR: offers ----------
class OfferIn(serializers.Serializer):
    designation = serializers.CharField(max_length=120)
    department = serializers.UUIDField()
    employment_type = serializers.ChoiceField(choices=Employee.EmploymentType.choices, default="FULL_TIME")
    joining_date = serializers.DateField()
    reporting_manager = serializers.UUIDField(required=False, allow_null=True)
    work_location = serializers.CharField(max_length=200)
    terms = serializers.CharField(required=False, allow_blank=True, default="")


class CandidateOfferView(APIView):
    """HR drafts the non-financial offer. Salary is never accepted here."""

    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        s = OfferIn(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        d["department"] = _dept(request, d["department"])
        mgr = d.get("reporting_manager")
        d["reporting_manager"] = Employee.objects.filter(organization=request.user.organization, pk=mgr).first() if mgr else None
        o = svc.draft_offer(_get(Candidate, request, pk), request.user, d, request)
        return Response(_offer(o, request.user.has_role(Role.SUPER_ADMIN)))


class OfferActionView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk, action):
        o = _get(Offer, request, pk)
        if action == "submit":
            o = svc.submit_offer(o, request.user, request)
        elif action == "withdraw":
            o = svc.withdraw_offer(o, request.user, str(request.data.get("note", "")), request)
        else:
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        return Response(_offer(o, request.user.has_role(Role.SUPER_ADMIN)))


# ---------- Super Admin ----------
class HiringView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        org = request.user.organization
        sel = Candidate.objects.filter(organization=org, stage__in=["SELECTION_PENDING", "INTERVIEWING"]).select_related("department")
        offers = Offer.objects.filter(organization=org, status="PENDING_ADMIN").select_related("candidate")
        return Response({"selection": [_candidate(c, request.user) for c in sel if svc.latest_feedback(c)],
                         "offers": [_candidate(o.candidate, request.user) for o in offers]})


class DecisionIn(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["SELECT", "REJECT", "APPROVE", "NEEDS_CHANGES"])
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    monthly_gross = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)


class CandidateDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        s = DecisionIn(data=request.data)
        s.is_valid(raise_exception=True)
        if s.validated_data["decision"] not in ("SELECT", "REJECT"):
            raise BusinessRuleError("INVALID_DECISION", "Select or reject.")
        c = svc.decide_candidate(_get(Candidate, request, pk), request.user, s.validated_data["decision"], s.validated_data["note"], request)
        return Response(_candidate(c, request.user))


class OfferDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        s = DecisionIn(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        o = svc.decide_offer(_get(Offer, request, pk), request.user, v["decision"], v["note"], v["monthly_gross"], web_base(request), request)
        return Response(_offer(o, True))


# ---------- candidate (public, token) ----------
class CandidateOfferPublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "candidate"

    def get(self, request, token):
        o = svc.by_token(token)
        if o is None:
            raise BusinessRuleError("INVALID_LINK", "This link isn't valid. Use the latest email from us.")
        return Response({"status": o.status, "company": o.organization.legal_name, "candidate": o.candidate.name, "designation": o.designation,
                         "joining_date": o.joining_date, "expires_at": o.expires_at, "letter": o.letter, "digest": o.digest, "responded_at": o.responded_at})

    def post(self, request, token):
        d = request.data
        o = svc.respond(token, str(d.get("decision", "")), str(d.get("signed_name", "")), bool(d.get("consent")), str(d.get("reason", "")), request)
        return self.get(request, token) if o else None
