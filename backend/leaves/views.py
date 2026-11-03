from datetime import date
from decimal import Decimal

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin, IsSuperAdminOrHR
from attendance.views import _employee
from common.errors import BusinessRuleError

from . import services as svc
from .models import Category, Holiday, HolidayCalendar, LeaveRequest


def _year(request) -> int:
    try:
        return int(request.query_params.get("year") or svc.today().year)
    except ValueError:
        raise BusinessRuleError("INVALID_YEAR", "Year must be a number.")


def _get(model, request, pk, **scope):
    obj = model.objects.filter(organization=request.user.organization, pk=pk, **scope).first()
    if obj is None:
        raise BusinessRuleError("NOT_FOUND", "Not found.")
    return obj


# ---------- holidays ----------
def _holiday(h: Holiday) -> dict:
    return {"date": h.date, "name": h.name, "kind": h.kind}


def _calendar(c: HolidayCalendar, diff=False) -> dict:
    out = {"id": str(c.id), "year": c.year, "revision": c.revision, "status": c.status, "note": c.note, "decision_note": c.decision_note,
           "created_by": c.created_by.display_name, "decided_at": c.decided_at, "created_at": c.created_at,
           "holidays": [_holiday(h) for h in c.holidays.all()]}
    if diff:
        out["changes"] = svc.calendar_diff(c)
    return out


class HolidayCalendarView(APIView):
    """Everyone: the published calendar for a year plus their own optional picks."""

    def get(self, request):
        emp, year = _employee(request), _year(request)
        cal = svc.published(emp.organization, year)
        chosen = set(emp.holiday_choices.filter(date__year=year).values_list("date", flat=True))
        holidays = [{**_holiday(h), "chosen": h.date in chosen} for h in cal.holidays.all()] if cal else []
        rules = svc.optional_rules(emp.organization)
        return Response({"year": year, "published": bool(cal), "revision": cal.revision if cal else None, "holidays": holidays,
                         "optional_limit": rules["per_employee"], "optional_chosen": sum(1 for h in holidays if h["chosen"] and h["kind"] == "OPTIONAL"),
                         "today": svc.today()})


class OptionalChoiceSerializer(serializers.Serializer):
    date = serializers.DateField()


class OptionalChoiceView(APIView):
    def post(self, request):
        s = OptionalChoiceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        svc.choose_optional(_employee(request), s.validated_data["date"], request.user, request)
        return Response({"ok": True}, status=201)

    def delete(self, request):
        s = OptionalChoiceSerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        svc.unchoose_optional(_employee(request), s.validated_data["date"], request.user, request)
        return Response(status=204)


class HolidayIn(serializers.Serializer):
    date = serializers.DateField()
    name = serializers.CharField(max_length=80, min_length=2)
    kind = serializers.ChoiceField(choices=Holiday.Kind.choices)


class DraftIn(serializers.Serializer):
    holidays = HolidayIn(many=True)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class HolidayDraftsView(APIView):
    """HR and Super Admin: list revisions for a year (GET) or open the year's draft (POST)."""

    permission_classes = [IsSuperAdminOrHR]

    def get(self, request):
        year = _year(request)
        cals = HolidayCalendar.objects.filter(organization=request.user.organization, year=year).select_related("created_by").prefetch_related("holidays")
        return Response({"year": year, "calendars": [_calendar(c, diff=c.status in ("DRAFT", "SUBMITTED")) for c in cals]})

    def post(self, request):
        cal = svc.open_draft(request.user.organization, _year(request), request.user)
        return Response(_calendar(cal, diff=True), status=201)


class HolidayDraftView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def put(self, request, pk):
        s = DraftIn(data=request.data)
        s.is_valid(raise_exception=True)
        cal = svc.save_draft(_get(HolidayCalendar, request, pk), s.validated_data["holidays"], s.validated_data["note"], request.user, request)
        return Response(_calendar(cal, diff=True))


class HolidayDraftSubmitView(APIView):
    permission_classes = [IsSuperAdminOrHR]

    def post(self, request, pk):
        return Response(_calendar(svc.submit_draft(_get(HolidayCalendar, request, pk), request.user, request), diff=True))


class DecisionIn(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["APPROVE", "REJECT", "NEEDS_CHANGES"])
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class HolidayDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        s = DecisionIn(data=request.data)
        s.is_valid(raise_exception=True)
        cal = svc.decide_calendar(_get(HolidayCalendar, request, pk), request.user, s.validated_data["decision"] == "APPROVE", s.validated_data["note"], request)
        return Response(_calendar(cal))


# ---------- leave ----------
def _leave(r: LeaveRequest, admin=False) -> dict:
    out = {"id": str(r.id), "category": r.category, "category_name": r.get_category_display(), "start": r.start, "end": r.end, "half_day": r.half_day,
           "days": r.days, "reason": r.reason, "status": r.status, "decision_note": r.decision_note, "decided_at": r.decided_at, "created_at": r.created_at,
           "cancellable": r.status in LeaveRequest.HOLDING or (r.status == "APPROVED" and r.start > svc.today())}
    if admin:
        out["employee"] = {"id": str(r.employee_id), "display_name": r.employee.display_name, "employee_code": r.employee.employee_code, "designation": r.employee.designation}
    return out


def _bal(b: dict) -> dict:
    return {k: {kk: float(vv) if isinstance(vv, Decimal) else vv for kk, vv in v.items()} | {"name": Category(k).label} for k, v in b.items()}


class LeaveIn(serializers.Serializer):
    category = serializers.ChoiceField(choices=Category.choices)
    start = serializers.DateField()
    end = serializers.DateField()
    half_day = serializers.BooleanField(default=False)
    reason = serializers.CharField(max_length=500, allow_blank=True)


class LeaveBalancesView(APIView):
    def get(self, request):
        emp, year = _employee(request), _year(request)
        return Response({"year": year, "balances": _bal(svc.balances(emp, year)), "on_probation": emp.status == "PROBATION"})


class LeaveRequestsView(APIView):
    def get(self, request):
        emp = _employee(request)
        return Response({"requests": [_leave(r) for r in emp.leave_requests.all()[:100]]})

    def post(self, request):
        s = LeaveIn(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(_leave(svc.apply(_employee(request), request.user, **s.validated_data, request=request)), status=201)


class LeavePreviewView(APIView):
    """Working days the dates would use (weekends and holidays excluded), so the form can show the count."""

    def get(self, request):
        emp = _employee(request)
        try:
            start, end = date.fromisoformat(request.query_params["start"]), date.fromisoformat(request.query_params["end"])
        except (KeyError, ValueError):
            raise BusinessRuleError("INVALID_DATES", "Pick valid dates.")
        if end < start or (end - start).days > 366:
            return Response({"days": 0, "holidays": []})
        off = svc.employee_holidays(emp, start, end)
        return Response({"days": len(svc.working_days(emp, start, end)), "holidays": [{"date": d, "name": n} for d, n in sorted(off.items())]})


class LeaveRequestView(APIView):
    def put(self, request, pk):
        r = _get(LeaveRequest, request, pk, employee=_employee(request))
        s = LeaveIn(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(_leave(svc.resubmit(r, request.user, **s.validated_data, request=request)))


class LeaveCancelView(APIView):
    def post(self, request, pk):
        r = _get(LeaveRequest, request, pk, employee=_employee(request))
        return Response(_leave(svc.cancel(r, request.user, request)))


class AdminLeaveRequestsView(APIView):
    """Super Admin only: HR must never see or approve others' leave (BRD §6.1)."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = LeaveRequest.objects.filter(organization=request.user.organization).select_related("employee")
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return Response({"requests": [_leave(r, admin=True) for r in qs[:300]]})


class AdminLeaveDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        s = DecisionIn(data=request.data)
        s.is_valid(raise_exception=True)
        r = svc.decide(_get(LeaveRequest, request, pk), request.user, s.validated_data["decision"], s.validated_data["note"], request)
        out = _leave(r, admin=True)
        out["balance"] = _bal(svc.balances(r.employee, r.start.year))[r.category]
        return Response(out)


class AdminLeaveBalanceView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, employee_id):
        from employees.models import Employee
        emp = Employee.objects.filter(organization=request.user.organization, pk=employee_id).first()
        if emp is None:
            raise BusinessRuleError("NOT_FOUND", "Employee not found.")
        return Response({"balances": _bal(svc.balances(emp, _year(request)))})


# ---------- holiday work and comp-off (BRD §7) ----------
from . import holiday_work as hws  # noqa: E402
from .models import HolidayWork  # noqa: E402


def _hw(h: HolidayWork, admin=False) -> dict:
    out = {"id": str(h.id), "work_date": h.work_date, "day_label": h.day_label, "title": h.title, "purpose": h.purpose, "expected_hours": float(h.expected_hours),
           "emergency": h.emergency, "status": h.status, "intervals": h.intervals, "running": h.running, "worked_seconds": h.worked_seconds,
           "summary": h.summary, "task_refs": h.task_refs, "approved_hours": h.approved_hours and float(h.approved_hours), "units": h.units and float(h.units),
           "decision_note": h.decision_note, "review_note": h.review_note, "created_at": h.created_at,
           "can_work": h.status in ("APPROVED", "EMERGENCY") and h.work_date == svc.today(),
           "cancellable": h.status in ("REQUESTED", "APPROVED", "EMERGENCY") and not h.intervals}
    if admin:
        out["employee"] = {"id": str(h.employee_id), "display_name": h.employee.display_name, "employee_code": h.employee.employee_code, "designation": h.employee.designation}
    return out


class HolidayWorkIn(serializers.Serializer):
    work_date = serializers.DateField()
    title = serializers.CharField(max_length=120, allow_blank=True)
    purpose = serializers.CharField(max_length=500, allow_blank=True)
    expected_hours = serializers.DecimalField(max_digits=3, decimal_places=1)
    emergency = serializers.BooleanField(default=False)


class HolidayWorkListView(APIView):
    def get(self, request):
        emp = _employee(request)
        b = _bal({"CO": hws.balance(emp)})["CO"]
        return Response({"requests": [_hw(h) for h in emp.holiday_work.all()[:100]], "eligible": hws.eligible_dates(emp), "balance": b,
                         "rule_active": hws.rule(emp.organization)["active"]})

    def post(self, request):
        s = HolidayWorkIn(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(_hw(hws.request_work(_employee(request), request.user, **s.validated_data, request=request)), status=201)


class HolidayWorkActionView(APIView):
    def post(self, request, pk, action):
        h = _get(HolidayWork, request, pk, employee=_employee(request))
        if action == "start":
            h = hws.start(h, request.user, request)
        elif action == "pause":
            h = hws.pause(h, request.user, request)
        elif action == "stop":
            h = hws.stop(h, request.user, summary=str(request.data.get("summary", "")), task_refs=str(request.data.get("task_refs", "")), request=request)
        elif action == "cancel":
            h = hws.cancel(h, request.user, request)
        else:
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        return Response(_hw(h))


class AdminHolidayWorkView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = HolidayWork.objects.filter(organization=request.user.organization).select_related("employee")
        if st := request.query_params.get("status"):
            qs = qs.filter(status__in=st.split(","))
        return Response({"requests": [_hw(h, admin=True) for h in qs[:300]], "rule": hws.rule(request.user.organization)})


class HolidayWorkDecisionIn(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["APPROVE", "REJECT", "CREDIT", "NO_CREDIT"])
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    hours = serializers.DecimalField(max_digits=4, decimal_places=1, required=False, allow_null=True, default=None)


class AdminHolidayWorkDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        s = HolidayWorkDecisionIn(data=request.data)
        s.is_valid(raise_exception=True)
        h = hws.decide(_get(HolidayWork, request, pk), request.user, request=request, **s.validated_data)
        return Response(_hw(h, admin=True))


class CompOffRuleIn(serializers.Serializer):
    active = serializers.BooleanField()
    full_day_hours = serializers.DecimalField(max_digits=3, decimal_places=1)
    half_day_hours = serializers.DecimalField(max_digits=3, decimal_places=1)
    expiry_days = serializers.IntegerField()
    review_note = serializers.CharField(max_length=500, allow_blank=True, default="")


class CompOffRuleView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        row = hws.rule_row(request.user.organization)
        return Response({**hws.rule(request.user.organization), "updated_by": row.created_by.display_name if row and row.created_by else None,
                         "effective_from": row.effective_from if row else None})

    def put(self, request):
        s = CompOffRuleIn(data=request.data)
        s.is_valid(raise_exception=True)
        hws.set_rule(request.user.organization, request.user, **s.validated_data, request=request)
        return self.get(request)
