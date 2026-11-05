from datetime import date

from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsSuperAdmin, IsSuperAdminOrHR
from attendance.views import _employee
from common.errors import BusinessRuleError
from common.files import serve
from employees.models import Employee

from . import services as svc
from .models import Review


def _get(request, pk) -> Review:
    r = Review.objects.filter(organization=request.user.organization, pk=pk).select_related("employee", "manager").first()
    if r is None:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    return r


def _person(e):
    return {"id": str(e.id), "display_name": e.display_name, "designation": e.designation} if e else None


def _review(r: Review, view: str) -> dict:
    """view: 'self' (the employee), 'manager', 'hr' (status only) or 'admin' (everything, including salary)."""
    out = {"id": str(r.id), "employee": _person(r.employee), "manager": _person(r.manager), "cycle_year": r.cycle_year, "due_date": r.due_date, "opened_on": r.opened_on,
           "status": r.status, "template_code": r.template_code, "self_submitted_at": r.self_submitted_at, "meeting_date": r.meeting_date,
           "employee_ack_at": r.employee_ack_at, "manager_completed_at": r.manager_completed_at, "approved_at": r.approved_at}
    if view == "hr":
        return out
    out |= {"questions": r.questions, "self_answers": r.self_answers if view != "manager" or r.status != "OPEN" else [], "self_score": r.self_score,
            "attachments": [{"id": str(f.id), "name": f.name} for f in r.attachments.all()], "strengths": r.strengths, "development_plan": r.development_plan,
            "disagreements": r.disagreements, "employee_comments": r.employee_comments}
    if view in ("manager", "admin"):
        out |= {"manager_answers": r.manager_answers, "manager_score": r.manager_score, "manager_comments": r.manager_comments, "recommendation": r.recommendation,
                "recommendation_note": r.recommendation_note, "admin_note": r.admin_note}
    if r.status == "APPROVED":
        out |= {"final_rating": r.final_rating, "new_designation": r.new_designation, "effective_date": r.effective_date}
    if view == "admin":
        cur = r.employee.salary_versions.filter(effective_from__lte=svc.today()).order_by("-effective_from").first()
        out |= {"current_gross": cur.monthly_gross if cur else None, "new_gross": r.salary_version.monthly_gross if r.salary_version_id else None}
    return out


# ---------- employee ----------
class MyAppraisalView(APIView):
    def get(self, request):
        emp = _employee(request)
        svc.ensure(emp.organization)
        svc.apply_due_promotions(emp.organization)
        first = svc.anniversary(emp, emp.start_date.year + 1)
        return Response({"reviews": [_review(r, "self") for r in emp.reviews.select_related("employee", "manager")[:10]], "next_due": max(svc.next_due(emp), first),
                         "open_days": 30})


class MyAppraisalActionView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk, action):
        emp = _employee(request)
        r = _get(request, pk)
        if r.employee_id != emp.pk:
            raise BusinessRuleError("NOT_FOUND", "Not found.")
        if action == "self":
            answers = request.data.get("answers")
            if not isinstance(answers, list):
                raise BusinessRuleError("ANSWER_REQUIRED", "Send your answers.")
            r = svc.save_self(r, emp, answers, bool(request.data.get("submit")), request)
        elif action == "attachments":
            r = svc.attach(r, emp, request.FILES.get("file"), request)
        elif action == "acknowledge":
            r = svc.acknowledge(r, emp, str(request.data.get("comments", "")), request)
        else:
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        return Response(_review(r, "self"))


class AttachmentView(APIView):
    def get(self, request, pk, fid):
        r = _get(request, pk)
        emp = getattr(request.user, "employee", None)
        ok = (emp and r.employee_id == emp.pk) or svc.can_manage(r, request.user) or request.user.has_role(Role.SUPER_ADMIN)
        f = r.attachments.filter(pk=fid).first() if ok else None
        if f is None:
            raise BusinessRuleError("NOT_FOUND", "Not found.")
        return serve(f)


# ---------- manager ----------
class TeamReviewsView(APIView):
    def get(self, request):
        emp = _employee(request)
        svc.ensure(emp.organization)
        qs = Review.objects.filter(manager=emp).select_related("employee", "manager")
        if request.user.has_role(Role.SUPER_ADMIN):
            qs = qs | Review.objects.filter(organization=emp.organization, manager__isnull=True).select_related("employee", "manager")
        return Response({"reviews": [_review(r, "manager") for r in qs.order_by("status", "due_date")[:200]]})


class TeamReviewActionView(APIView):
    def post(self, request, pk, action):
        r = _get(request, pk)
        d = request.data
        if action == "save":
            r = svc.save_manager(r, request.user, answers=d.get("answers") or [], comments=str(d.get("comments", "")), recommendation=str(d.get("recommendation", "NONE")),
                                 recommendation_note=str(d.get("recommendation_note", "")), request=request)
        elif action == "meeting":
            try:
                md = date.fromisoformat(str(d.get("meeting_date")))
            except ValueError:
                raise BusinessRuleError("INVALID_DATE", "Pick the meeting date.")
            r = svc.record_meeting(r, request.user, meeting_date=md, strengths=str(d.get("strengths", "")), development_plan=str(d.get("development_plan", "")),
                                   disagreements=str(d.get("disagreements", "")), request=request)
        elif action == "complete":
            r = svc.complete(r, request.user, request)
        else:
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        return Response(_review(r, "manager"))


# ---------- HR (status only) and Super Admin ----------
class HRAppraisalsView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def get(self, request):
        svc.ensure(request.user.organization)
        qs = Review.objects.filter(organization=request.user.organization).select_related("employee", "manager")[:300]
        return Response({"reviews": [_review(r, "hr") for r in qs]})


class AdminAppraisalsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        org = request.user.organization
        svc.ensure(org)
        svc.apply_due_promotions(org)
        qs = Review.objects.filter(organization=org).select_related("employee", "manager", "salary_version")
        if st := request.query_params.get("status"):
            qs = qs.filter(status__in=st.split(","))
        has = set(Review.objects.filter(organization=org).values_list("employee_id", flat=True))
        upcoming = sorted(({"id": str(e.id), "display_name": e.display_name, "designation": e.designation, "next_due": svc.next_due(e), "has_review": e.pk in has}
                           for e in Employee.objects.filter(organization=org, status__in=svc.ACTIVE)), key=lambda x: x["next_due"])
        return Response({"reviews": [_review(r, "admin") for r in qs[:300]], "employees": upcoming})

    def post(self, request):
        emp = Employee.objects.filter(organization=request.user.organization, pk=request.data.get("employee")).first()
        if emp is None:
            raise BusinessRuleError("NOT_FOUND", "Employee not found.")
        return Response(_review(svc.start_now(emp, request.user, request), "admin"), status=201)


class AdminDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        d = request.data
        eff = None
        if d.get("effective_date"):
            try:
                eff = date.fromisoformat(str(d["effective_date"]))
            except ValueError:
                raise BusinessRuleError("INVALID_DATE", "Pick a valid effective date.")
        r = svc.decide(_get(request, pk), request.user, str(d.get("decision", "")), note=str(d.get("note", "")), final_rating=d.get("final_rating"),
                       new_gross=d.get("new_gross"), new_designation=str(d.get("new_designation", "")), effective_date=eff, request=request)
        return Response(_review(r, "admin"))
