from datetime import date, timedelta

from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsSuperAdmin, IsSuperAdminOrHR
from attendance.views import _employee
from common.errors import BusinessRuleError
from common.files import serve, store
from employees.models import Employee

from . import services as svc
from .models import Allocation, Asset, ExitCase, Resignation


def _get(model, request, pk, **scope):
    obj = model.objects.filter(organization=request.user.organization, pk=pk, **scope).first()
    if obj is None:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    return obj


def _date(v, field):
    try:
        return date.fromisoformat(str(v))
    except (TypeError, ValueError):
        raise BusinessRuleError("INVALID_DATE", "Pick a valid date.", field_errors={field: ["Invalid date."]})


def _person(e: Employee | None):
    return {"id": str(e.id), "display_name": e.display_name, "designation": e.designation} if e else None


def _alloc(a: Allocation, admin=False) -> dict:
    return {"id": str(a.id), "asset": _asset(a.asset, admin, with_current=False), "employee": _person(a.employee), "assigned_at": a.assigned_at, "assign_note": a.assign_note,
            "ack_at": a.ack_at, "return_started_at": a.return_started_at, "condition": a.condition, "return_note": a.return_note, "hr_ack_at": a.hr_ack_at,
            "emp_ack_at": a.emp_ack_at, "emp_agrees": a.emp_agrees, "emp_note": a.emp_note, "disputed": a.disputed, "admin_decision": a.admin_decision,
            "admin_note": a.admin_note, "closed_at": a.closed_at}


def _asset(x: Asset, admin=False, with_current=True) -> dict:
    out = {"id": str(x.id), "category": x.category, "category_name": x.get_category_display(), "make_model": x.make_model, "tag": x.tag, "serial": x.serial,
           "purchase_ref": x.purchase_ref, "location": x.location, "state": x.state, "owner": _person(x.owner), "created_at": x.created_at}
    if admin:
        out["cost"] = x.cost
    if with_current:
        cur = x.allocations.filter(closed_at__isnull=True).select_related("employee").first()
        out["current"] = _alloc(cur, admin) if cur else None
    return out


# ---------- assets: HR ----------
class AssetsView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def get(self, request):
        admin = request.user.has_role(Role.SUPER_ADMIN)
        qs = Asset.objects.filter(organization=request.user.organization).select_related("owner")
        if st := request.query_params.get("state"):
            qs = qs.filter(state__in=st.split(","))
        return Response({"assets": [_asset(a, admin) for a in qs[:500]], "categories": dict(Asset.Category.choices)})

    def post(self, request):
        d = dict(request.data.items()) if hasattr(request.data, "items") else {}
        d["owner"] = _get(Employee, request, d["owner"]) if d.get("owner") else None
        admin = request.user.has_role(Role.SUPER_ADMIN)
        if admin and d.get("cost") not in (None, ""):
            try:
                d["cost"] = svc.money(d["cost"])
            except Exception:
                raise BusinessRuleError("INVALID_AMOUNT", "Cost must be a number.")
        else:
            d["cost"] = None
        a = svc.create_asset(request.user.organization, request.user, d, admin, request)
        return Response(_asset(a, admin), status=201)


class AssetAssignView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        a = svc.assign(_get(Asset, request, pk), _get(Employee, request, request.data.get("employee")), request.user, str(request.data.get("note", "")), request)
        return Response(_alloc(a), status=201)


class AllocationHRView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk, action):
        al = _get(Allocation, request, pk)
        if action == "return-start":
            al = svc.start_return(al, request.user, request)
        elif action == "return":
            al = svc.record_return(al, request.user, str(request.data.get("condition", "")), str(request.data.get("note", "")), request)
        else:
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        return Response(_alloc(al))


# ---------- assets: employee ----------
class MyAssetsView(APIView):
    def get(self, request):
        emp = _employee(request)
        return Response({"allocations": [_alloc(a) for a in emp.allocations.select_related("asset", "employee")[:100]],
                         "personal": [_asset(a, with_current=False) for a in emp.personal_devices.all()]})


class MyAllocationView(APIView):
    def post(self, request, pk, action):
        emp = _employee(request)
        al = _get(Allocation, request, pk, employee=emp)
        if action == "acknowledge":
            al = svc.acknowledge(al, emp, str(request.data.get("typed", "")), str(request.data.get("note", "")), request)
        elif action == "confirm-return":
            al = svc.confirm_return(al, emp, bool(request.data.get("agrees")), str(request.data.get("note", "")), request)
        else:
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        return Response(_alloc(al))


# ---------- assets: Super Admin ----------
class AllocationResolveView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        al = svc.resolve(_get(Allocation, request, pk), request.user, str(request.data.get("decision", "")), str(request.data.get("note", "")), request)
        return Response(_alloc(al, True))


class AssetStateView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        a = svc.set_asset_state(_get(Asset, request, pk), request.user, str(request.data.get("state", "")), str(request.data.get("note", "")), request)
        return Response(_asset(a, True))


class DisputesView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Allocation.objects.filter(organization=request.user.organization, disputed=True, closed_at__isnull=True).select_related("asset", "employee")
        return Response({"disputes": [_alloc(a, True) for a in qs]})


# ---------- resignation: employee ----------
def _resignation(r: Resignation) -> dict:
    return {"id": str(r.id), "employee": _person(r.employee), "reason": r.reason, "submitted_on": r.submitted_on, "proposed_last_day": r.proposed_last_day,
            "notice_days": r.notice_days, "short_notice": r.proposed_last_day < r.submitted_on + timedelta(days=r.notice_days), "letter": r.letter, "revision": r.revision,
            "has_own_letter": bool(r.own_letter_id), "status": r.status, "admin_note": r.admin_note, "accepted_last_day": r.accepted_last_day, "decided_at": r.decided_at,
            "history": r.history}


class MyResignationView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        emp = _employee(request)
        r = emp.resignations.first()
        notice = svc.notice_days(emp.organization)
        return Response({"resignation": _resignation(r) if r else None, "notice_days": notice, "earliest_full_notice": svc.today() + timedelta(days=notice),
                         "can_submit": emp.status in ("PROBATION", "ACTIVE_CONFIRMED") and not emp.resignations.filter(status__in=[*Resignation.OPEN, "ACCEPTED"]).exists()})

    def post(self, request):
        emp = _employee(request)
        f = request.FILES.get("own_letter")
        own = store(f, emp.organization, request.user, allowed=("pdf",)) if f else None
        r = svc.submit_resignation(emp, reason=str(request.data.get("reason", "")), proposed_last_day=_date(request.data.get("proposed_last_day"), "proposed_last_day"),
                                   own_letter=own, request=request)
        return Response(_resignation(r), status=201)


class ResignationPreviewView(APIView):
    def get(self, request):
        emp = _employee(request)
        d = _date(request.query_params.get("last_day"), "last_day")
        return Response({"letter": svc.resignation_letter(emp, request.query_params.get("reason") or "…", svc.today(), d),
                         "short_notice": d < svc.today() + timedelta(days=svc.notice_days(emp.organization))})


class MyResignationActionView(APIView):
    def post(self, request, pk, action):
        emp = _employee(request)
        r = _get(Resignation, request, pk, employee=emp)
        if action == "revise":
            r = svc.revise(r, emp, reason=str(request.data.get("reason", "")), proposed_last_day=_date(request.data.get("proposed_last_day"), "proposed_last_day"), request=request)
        elif action == "withdraw":
            r = svc.withdraw_resignation(r, emp, request)
        else:
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        return Response(_resignation(r))


class OwnLetterView(APIView):
    def get(self, request, pk):
        r = _get(Resignation, request, pk)
        emp = getattr(request.user, "employee", None)
        if not r.own_letter_id or not (request.user.has_role(Role.SUPER_ADMIN, Role.HR_OPERATIONS) or (emp and r.employee_id == emp.pk)):
            raise BusinessRuleError("NOT_FOUND", "Not found.")
        return serve(r.own_letter)


# ---------- exits: HR and Super Admin ----------
def _exit(ex: ExitCase, admin: bool) -> dict:
    st = getattr(ex, "settlement", None)
    out = {"id": str(ex.id), "employee": _person(ex.employee), "last_working_day": ex.last_working_day, "checklist": ex.checklist, "status": ex.status,
           "blockers": svc.blockers(ex), "assets": [_alloc(a, admin) for a in svc.open_assets(ex.employee)], "fnf_status": st.status if st else "NOT_STARTED",
           "letters": [{"id": str(x.id), "kind": x.kind, "status": x.status} for x in ex.employee.letters.filter(source=f"exit:{ex.pk}")],
           "completed_at": ex.completed_at, "can_complete": svc.today() >= ex.last_working_day}
    if admin and st:
        out["settlement"] = {"lines": st.lines, "info": st.info, "net": st.net, "status": st.status, "approved_at": st.approved_at, "digest": st.digest}
    return out


class ExitsView(APIView):
    """HR sees the checklist and status only (never amounts); the Super Admin also gets the settlement."""

    permission_classes = [IsSuperAdminOrHR]

    def get(self, request):
        admin = request.user.has_role(Role.SUPER_ADMIN)
        org = request.user.organization
        res = Resignation.objects.filter(organization=org, status__in=Resignation.OPEN).select_related("employee")
        exits = ExitCase.objects.filter(organization=org).select_related("employee").order_by("status", "last_working_day")[:100]
        return Response({"resignations": [_resignation(r) for r in res], "exits": [_exit(e, admin) for e in exits]})


class ExitChecklistView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        ex = svc.set_exit_check(_get(ExitCase, request, pk), request.user, str(request.data.get("key", "")), bool(request.data.get("done")), request)
        return Response(_exit(ex, request.user.has_role(Role.SUPER_ADMIN)))


class ExitCompleteView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        ex = svc.complete_exit(_get(ExitCase, request, pk), request.user, request)
        return Response(_exit(ex, request.user.has_role(Role.SUPER_ADMIN)))


class ResignationDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        d = request.data
        last = _date(d["last_day"], "last_day") if d.get("last_day") else None
        r = svc.decide_resignation(_get(Resignation, request, pk), request.user, str(d.get("decision", "")), str(d.get("note", "")), last, request)
        return Response(_resignation(r))


class SettlementView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        ex = _get(ExitCase, request, pk)
        svc.draft_settlement(ex)
        return Response(_exit(ExitCase.objects.get(pk=ex.pk), True))

    def put(self, request, pk):
        ex = _get(ExitCase, request, pk)
        lines = request.data.get("lines")
        if not isinstance(lines, list):
            raise BusinessRuleError("INVALID_LINE", "Send the settlement lines.")
        svc.edit_settlement(ex, request.user, lines, request)
        return Response(_exit(ExitCase.objects.get(pk=ex.pk), True))


class SettlementApproveView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        ex = _get(ExitCase, request, pk)
        svc.approve_settlement(ex, request.user, request)
        return Response(_exit(ExitCase.objects.get(pk=ex.pk), True))
