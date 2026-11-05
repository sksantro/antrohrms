from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsSuperAdmin, IsSuperAdminOrHR
from attendance.views import _employee
from common.errors import BusinessRuleError
from common.files import serve
from employees.models import Employee
from employees.services import web_base
from recruitment.models import Candidate

from . import letters as lt
from . import services as svc
from .models import CandidateDocument, Letter, LetterTemplate, ProbationReview


def _int(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        raise BusinessRuleError("INVALID_NUMBER", "Enter a whole number.")


def _get(model, request, pk, **scope):
    obj = model.objects.filter(organization=request.user.organization, pk=pk, **scope).first()
    if obj is None:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    return obj


def _doc(d: CandidateDocument) -> dict:
    return {"id": str(d.id), "category": d.category, "label": svc.CATEGORIES.get(d.category, d.category), "status": d.status, "hr_note": d.hr_note,
            "file_name": d.file.name, "size": d.file.size, "uploaded_at": d.created_at, "reviewed_at": d.reviewed_at}


def _hire(c: Candidate) -> dict:
    from recruitment.models import Offer
    o = c.offers.filter(status__in=[Offer.Status.ACCEPTED]).select_related("department").first()
    dr = getattr(c, "document_request", None)
    ob = getattr(c, "onboarding", None)
    return {"id": str(c.id), "name": c.name, "email": c.email, "phone": c.phone, "stage": c.stage,
            "offer": {"designation": o.designation, "department": o.department.name, "joining_date": o.joining_date} if o else None,
            "request": {"categories": dr.categories, "labels": [svc.CATEGORIES[x] for x in dr.categories], "link_expires_at": dr.link_expires_at,
                        "link_used": bool(dr.link_used_at), "open": dr.open} if dr else None,
            "documents": [_doc(d) for d in c.documents.filter(superseded=False).select_related("file")],
            "missing": svc.missing(c), "checklist": ob.checklist if ob else [], "joined_at": ob.joined_at if ob else None,
            "employee_id": str(ob.employee_id) if ob and ob.employee_id else None}


class OnboardingView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def get(self, request):
        org = request.user.organization
        hires = Candidate.objects.filter(organization=org, stage__in=["OFFER_ACCEPTED", "JOINED"]).order_by("stage", "-updated_at")[:100]
        reviews = ProbationReview.objects.filter(organization=org).select_related("employee")[:50]
        return Response({"hires": [_hire(c) for c in hires], "categories": svc.CATEGORIES,
                         "probation_due": [{"id": str(e.id), "display_name": e.display_name, "designation": e.designation, "department": e.department.name,
                                            "start_date": e.start_date, "probation_end": e.probation_end} for e in svc.due(org)],
                         "probation_reviews": [_review(r) for r in reviews]})


class RequestDocsView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        cats = request.data.get("categories") or []
        if not isinstance(cats, list):
            raise BusinessRuleError("CATEGORIES_REQUIRED", "Pick documents to request.")
        c = _get(Candidate, request, pk)
        svc.request_documents(c, request.user, [str(x) for x in cats], web_base(request), request)
        return Response(_hire(c))


class ReviewDocView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        d = svc.review(_get(CandidateDocument, request, pk), request.user, str(request.data.get("status", "")), str(request.data.get("note", "")), request)
        return Response(_doc(d))


class DocFileView(APIView):
    """HR and Super Admin; after joining, also the employee the document belongs to."""

    def get(self, request, pk):
        d = _get(CandidateDocument, request, pk)
        emp = getattr(request.user, "employee", None)
        if not (request.user.has_role(Role.SUPER_ADMIN, Role.HR_OPERATIONS) or (emp and d.employee_id == emp.pk)):
            raise BusinessRuleError("NOT_FOUND", "Not found.")
        return serve(d.file)


class ChecklistView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        c = _get(Candidate, request, pk)
        svc.set_check(c, request.user, str(request.data.get("key", "")), bool(request.data.get("done")), request)
        return Response(_hire(c))


class JoinView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        c = _get(Candidate, request, pk)
        emp = svc.mark_joined(c, request.user, str(request.data.get("official_email", "")), request)
        return Response({**_hire(Candidate.objects.get(pk=c.pk)), "employee_code": emp.employee_code}, status=201)


# ---------- candidate portal (public) ----------
class Portal(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "candidate"


class PortalOtpView(Portal):
    def post(self, request, token):
        return Response(svc.send_otp(token))


class PortalVerifyView(Portal):
    def post(self, request, token):
        try:
            return Response({"session": svc.verify_otp(token, str(request.data.get("code", "")))})
        except svc.WrongCode as e:
            from common.middleware import current_request_id
            return Response({"code": e.get_codes(), "message": str(e.detail), "field_errors": {}, "request_id": current_request_id()}, status=422)


def _portal(dr) -> dict:
    c = dr.candidate
    docs = {d.category: _doc(d) for d in c.documents.filter(superseded=False).select_related("file")}
    return {"name": c.name, "company": dr.organization.legal_name, "session_expires_at": dr.session_expires_at,
            "items": [{"category": x, "label": svc.CATEGORIES[x], "document": docs.get(x)} for x in dr.categories]}


class PortalSessionView(Portal):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(_portal(svc.by_session(request.headers.get("X-Portal-Session", ""))))

    def post(self, request):
        dr = svc.by_session(request.headers.get("X-Portal-Session", ""))
        svc.upload(dr, str(request.data.get("category", "")), request.FILES.get("file"))
        return Response(_portal(dr), status=201)


# ---------- letters ----------
def _letter(x: Letter, user) -> dict:
    admin = user.has_role(Role.SUPER_ADMIN)
    own = getattr(user, "employee", None) and x.employee_id == user.employee.pk
    body = x.content if x.status == "RELEASED" and (admin or own) else lt.render(x, redact=not admin)
    return {"id": str(x.id), "kind": x.kind, "title": lt.TITLES[x.kind], "status": x.status, "employee": {"id": str(x.employee_id), "display_name": x.employee.display_name},
            "note": x.note, "admin_note": x.admin_note, "content": body, "digest": x.digest, "released_at": x.released_at, "created_at": x.created_at,
            "template_version": x.template.version, "editable": x.status == "DRAFT" and not x.source.startswith("probation")}


class LettersView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def get(self, request):
        qs = Letter.objects.filter(organization=request.user.organization).select_related("employee", "template", "employee__department")
        if st := request.query_params.get("status"):
            qs = qs.filter(status__in=st.split(","))
        return Response({"letters": [_letter(x, request.user) for x in qs[:200]], "kinds": {k: lt.TITLES[k] for k in sorted(lt.HR_DRAFTABLE)}})

    def post(self, request):
        kind = str(request.data.get("kind", ""))
        if kind not in lt.HR_DRAFTABLE:
            raise BusinessRuleError("INVALID_KIND", "Pick a letter type.")
        emp = _get(Employee, request, request.data.get("employee"))
        ctx = {k: str(request.data.get(k, ""))[:60] for k in ("exit.resignation_date", "exit.last_working_date") if request.data.get(k)}
        x = lt.draft(emp, kind, request.user, note=str(request.data.get("note", ""))[:2000], ctx=ctx, request=request)
        return Response(_letter(x, request.user), status=201)


class LetterView(APIView):
    def get(self, request, pk):
        x = _get(Letter, request, pk)
        emp = getattr(request.user, "employee", None)
        if not (request.user.has_role(Role.SUPER_ADMIN, Role.HR_OPERATIONS) or (emp and x.employee_id == emp.pk and x.status == "RELEASED")):
            raise BusinessRuleError("NOT_FOUND", "Not found.")
        return Response(_letter(x, request.user))

    def put(self, request, pk):
        if not request.user.has_role(Role.SUPER_ADMIN, Role.HR_OPERATIONS):
            raise BusinessRuleError("NOT_FOUND", "Not found.")
        x = _get(Letter, request, pk)
        if x.status != "DRAFT":
            raise BusinessRuleError("NOT_DRAFT", "Only a draft can be edited.")
        x.note = str(request.data.get("note", x.note))[:2000]
        x.context = {**x.context, **{k: str(request.data[k])[:60] for k in ("exit.resignation_date", "exit.last_working_date") if k in request.data}}
        x.save(update_fields=["note", "context", "updated_at"])
        return Response(_letter(x, request.user))


class LetterSubmitView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        return Response(_letter(lt.submit(_get(Letter, request, pk), request.user, request), request.user))


class LetterDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        x = lt.decide(_get(Letter, request, pk), request.user, str(request.data.get("decision", "")), str(request.data.get("note", "")), request)
        return Response(_letter(x, request.user))


class MyDocumentsView(APIView):
    def get(self, request):
        emp = _employee(request)
        return Response({"letters": [_letter(x, request.user) for x in emp.letters.filter(status="RELEASED").select_related("template", "employee")],
                         "documents": [_doc(d) for d in emp.joining_documents.filter(superseded=False).select_related("file")]})


class TemplatesView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        org = request.user.organization
        return Response({"templates": [{"kind": k, "title": lt.TITLES[k], "version": (t := lt.template(org, k)).version, "body": t.body} for k in lt.DEFAULTS],
                         "placeholders": sorted(lt.VARS), "sensitive": sorted(lt.SENSITIVE)})

    def put(self, request):
        t = lt.save_template(request.user.organization, str(request.data.get("kind", "")), str(request.data.get("body", "")), request.user, request)
        return Response({"kind": t.kind, "version": t.version, "body": t.body})


# ---------- probation ----------
def _review(r: ProbationReview) -> dict:
    return {"id": str(r.id), "employee": {"id": str(r.employee_id), "display_name": r.employee.display_name, "designation": r.employee.designation},
            "due_on": r.due_on, "recommendation": r.recommendation, "extend_months": r.extend_months, "hr_note": r.hr_note, "status": r.status,
            "admin_note": r.admin_note, "decided_at": r.decided_at, "created_at": r.created_at}


class ProbationStartView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        d = request.data
        r = svc.start_review(_get(Employee, request, pk), request.user, str(d.get("recommendation", "")), str(d.get("note", "")), _int(d.get("extend_months")), request)
        return Response(_review(r), status=201)


class ProbationDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        d = request.data
        r = svc.decide_probation(_get(ProbationReview, request, pk), request.user, str(d.get("decision", "")), str(d.get("note", "")), _int(d.get("extend_months")), request)
        return Response(_review(r))


class AdminLettersView(APIView):
    """Super Admin: letters and probation reviews waiting for a decision, plus templates count."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        org = request.user.organization
        return Response({"letters": [_letter(x, request.user) for x in Letter.objects.filter(organization=org, status="PENDING_ADMIN").select_related("employee", "template")],
                         "probation": [_review(r) for r in ProbationReview.objects.filter(organization=org, status="PENDING_ADMIN").select_related("employee")],
                         "templates": LetterTemplate.objects.filter(organization=org).count()})

