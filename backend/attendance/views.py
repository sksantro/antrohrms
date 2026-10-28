from datetime import date, timedelta

from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from common.errors import BusinessRuleError
from common.models import OfficeSite
from common.services import audit

from . import services as svc
from .models import AttendanceCorrection, AttendanceDay, AttendanceEvent, Mode, WfhRequest


class LocationSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy_m = serializers.FloatField(min_value=0, max_value=100_000)


class LocationInput(serializers.Serializer):
    location = LocationSerializer(required=False, allow_null=True)
    location_error = serializers.CharField(required=False, allow_blank=True, max_length=120)

    def location_obj(self):
        loc = self.validated_data.get("location")
        return svc.Location(**loc) if loc else None


def _employee(request):
    emp = getattr(request.user, "employee", None)
    if emp is None:
        raise BusinessRuleError("NO_EMPLOYEE_PROFILE", "Your account has no employee profile.")
    return emp


def _key(request) -> str | None:
    k = request.headers.get("Idempotency-Key", "").strip()
    return k[:80] or None


def _today_response(emp, status=200):
    at = svc.now()
    day = svc.current_day(emp, at)
    if day is not None:
        day = AttendanceDay.objects.select_related("employee").prefetch_related("events", "presence_checks").get(pk=day.pk)
    return Response(svc.summary_payload(day, at, emp.organization, employee=emp), status=status)


class TodayView(APIView):
    def get(self, request):
        return _today_response(_employee(request))


class CheckInSerializer(LocationInput):
    mode = serializers.ChoiceField(choices=Mode.choices, default=Mode.WFO)
    plan = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    emergency_reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class CheckInView(APIView):
    def post(self, request):
        emp = _employee(request)
        s = CheckInSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        svc.check_in(employee=emp, actor=request.user, location=s.location_obj(), unavailable_reason=v.get("location_error", ""), key=_key(request), request=request,
                     mode=v["mode"], plan=v.get("plan", ""), emergency_reason=v.get("emergency_reason", ""))
        return _today_response(emp, 201)


class BreakSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["TEA", "LUNCH"])


class BreakStartView(APIView):
    def post(self, request):
        emp = _employee(request)
        s = BreakSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        svc.punch(employee=emp, actor=request.user, type_="START_" + s.validated_data["kind"], key=_key(request))
        return _today_response(emp)


class BreakResumeView(APIView):
    def post(self, request):
        emp = _employee(request)
        s = LocationInput(data=request.data)
        s.is_valid(raise_exception=True)
        svc.resume(employee=emp, actor=request.user, location=s.location_obj(), unavailable_reason=s.validated_data.get("location_error", ""), key=_key(request))
        return _today_response(emp)


class CheckOutSerializer(LocationInput):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
    summary = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class CheckOutView(APIView):
    def post(self, request):
        emp = _employee(request)
        s = CheckOutSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        svc.check_out(employee=emp, actor=request.user, reason=v.get("reason", ""), location=s.location_obj(), key=_key(request), request=request,
                      summary=v.get("summary", ""), unavailable_reason=v.get("location_error", ""))
        return _today_response(emp)


class VerifyLocationView(APIView):
    def post(self, request):
        emp = _employee(request)
        s = LocationInput(data=request.data)
        s.is_valid(raise_exception=True)
        svc.reverify(employee=emp, actor=request.user, location=s.location_obj(), unavailable_reason=s.validated_data.get("location_error", ""))
        return _today_response(emp)


def _day_row(d: AttendanceDay, at) -> dict:
    s = svc.derive(d.events.all(), at)
    p = svc.presence_summary(d, at)
    return {
        "mode": d.mode, "plan": d.plan, "summary": d.summary,
        "presence": {k: p[k] for k in ("total", "answered", "missed")} if p else None,
        "id": str(d.id), "work_date": d.work_date, "status": d.status, "check_in_at": d.check_in_at, "check_out_at": d.check_out_at,
        "work_seconds": s.work, "presence_seconds": s.presence, "tea_seconds": s.tea, "lunch_seconds": s.lunch, "tea_count": s.tea_count,
        "proof": d.proof, "review_status": d.review_status, "shortfall_reason": d.shortfall_reason,
        "events": [{"type": e.type, "at": e.at, "proof": e.proof, "note": e.note} for e in d.events.all()],
        "corrections": [{"id": str(c.id), "event_type": c.event_type, "proposed_at": c.proposed_at, "status": c.status, "decision_note": c.decision_note} for c in d.corrections.all()],
    }


class HistoryView(APIView):
    def get(self, request):
        emp = _employee(request)
        month = request.query_params.get("month") or timezone.localdate().strftime("%Y-%m")
        try:
            first = date.fromisoformat(month + "-01")
        except ValueError as e:
            raise BusinessRuleError("INVALID_MONTH", "Month must look like 2026-10.") from e
        nxt = date(first.year + first.month // 12, first.month % 12 + 1, 1)
        days = AttendanceDay.objects.filter(employee=emp, work_date__gte=first, work_date__lt=nxt).prefetch_related("events", "corrections", "presence_checks")
        at = svc.now()
        return Response({"month": month, "workdays": svc.policy(emp.organization, "attendance.workdays", []), "days": [_day_row(d, at) for d in days]})


class CorrectionSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=[c[0] for c in AttendanceCorrection.EVENT_CHOICES])
    proposed_at = serializers.DateTimeField()
    reason = serializers.CharField(min_length=5, max_length=500)


class RequestCorrectionView(APIView):
    def post(self, request, day_id):
        emp = _employee(request)
        day = AttendanceDay.objects.filter(pk=day_id, employee=emp).first()  # own days only; others are 404
        if day is None:
            raise BusinessRuleError("NOT_FOUND", "Attendance day not found.")
        s = CorrectionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        c = svc.request_correction(day=day, actor=request.user, **s.validated_data)
        return Response({"id": str(c.id), "status": c.status}, status=201)


class PresenceConfirmView(APIView):
    def post(self, request, check_id):
        emp = _employee(request)
        svc.confirm_presence(employee=emp, actor=request.user, check_id=check_id)
        return _today_response(emp)


def _wfh_row(r: WfhRequest) -> dict:
    return {"id": str(r.id), "date": r.date, "reason": r.reason, "emergency": r.emergency, "status": r.status,
            "decision_note": r.decision_note, "decided_at": r.decided_at, "created_at": r.created_at, "used": r.days.exists()}


class WfhRequestSerializer(serializers.Serializer):
    date = serializers.DateField()
    reason = serializers.CharField(min_length=5, max_length=500)


class WfhRequestsView(APIView):
    """Own work-from-home requests (this month onward, plus the last 60 days) and this month's usage."""

    def get(self, request):
        emp = _employee(request)
        today = timezone.localdate()
        since = today - timedelta(days=60)
        rows = WfhRequest.objects.filter(employee=emp, date__gte=since).prefetch_related("days")
        pol = svc.wfh_policy(emp.organization)
        return Response({"requests": [_wfh_row(r) for r in rows], "used_this_month": svc.wfh_used(emp, today), "monthly_limit": pol["monthly_limit"]})

    def post(self, request):
        emp = _employee(request)
        s = WfhRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        r = svc.request_wfh(employee=emp, actor=request.user, on=s.validated_data["date"], reason=s.validated_data["reason"], request=request)
        return Response(_wfh_row(r), status=201)


class WfhCancelView(APIView):
    def post(self, request, request_id):
        emp = _employee(request)
        r = WfhRequest.objects.filter(pk=request_id, employee=emp).first()
        if r is None:
            raise BusinessRuleError("NOT_FOUND", "Request not found.")
        return Response(_wfh_row(svc.cancel_wfh(req=r, actor=request.user, request=request)))


# ---------- Super Admin ----------
class AdminLiveView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response(svc.live_board(request.user.organization))


class AdminExceptionsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response({"items": svc.exceptions_queue(request.user.organization)})


def _admin_day(request, day_id) -> AttendanceDay:
    day = AttendanceDay.objects.filter(pk=day_id, organization=request.user.organization).select_related("employee").first()
    if day is None:
        raise BusinessRuleError("NOT_FOUND", "Attendance day not found.")
    return day


class AdminDayView(APIView):
    """Full evidence including location readings — Super Admin only (BRD §4.3)."""

    permission_classes = [IsSuperAdmin]

    def get(self, request, day_id):
        day = _admin_day(request, day_id)
        row = _day_row(day, svc.now())
        row["employee"] = {"display_name": day.employee.display_name, "employee_code": day.employee.employee_code}
        row["proof_note"], row["review_note"] = day.proof_note, day.review_note
        p = svc.presence_summary(day, svc.now())
        row["presence_checks"] = p["checks"] if p else []
        row["events"] = [{
            "type": e.type, "at": e.at, "proof": e.proof, "note": e.note, "distance_m": e.distance_m, "accuracy_m": e.accuracy_m,
            "latitude": e.latitude, "longitude": e.longitude, "by_admin": e.actor_id != day.employee.user_id,
        } for e in AttendanceEvent.objects.filter(day=day)]
        return Response(row)


class ReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["ACCEPT_PROOF", "ACKNOWLEDGE"])
    note = serializers.CharField(min_length=3, max_length=500)


class AdminReviewDayView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, day_id):
        day = _admin_day(request, day_id)
        s = ReviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        svc.review_day(day=day, actor=request.user, request=request, **s.validated_data)
        return Response({"ok": True})


class DecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    note = serializers.CharField(min_length=3, max_length=500)


class AdminCorrectionDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, correction_id):
        c = AttendanceCorrection.objects.filter(pk=correction_id, day__organization=request.user.organization).first()
        if c is None:
            raise BusinessRuleError("NOT_FOUND", "Correction not found.")
        s = DecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        c = svc.decide_correction(correction=c, actor=request.user, approve=s.validated_data["decision"] == "APPROVE", note=s.validated_data["note"], request=request)
        return Response({"id": str(c.id), "status": c.status})


class AdminWfhDecisionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, request_id):
        r = WfhRequest.objects.filter(pk=request_id, organization=request.user.organization).first()
        if r is None:
            raise BusinessRuleError("NOT_FOUND", "Request not found.")
        s = DecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        r = svc.decide_wfh(req=r, actor=request.user, approve=s.validated_data["decision"] == "APPROVE", note=s.validated_data["note"], request=request)
        return Response(_wfh_row(r))


class OfficeSiteSerializer(serializers.ModelSerializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=-90, max_value=90, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=-180, max_value=180, allow_null=True)
    radius_m = serializers.IntegerField(min_value=10, max_value=1000)

    class Meta:
        model = OfficeSite
        fields = ["id", "name", "address", "latitude", "longitude", "radius_m"]
        read_only_fields = ["id"]


class AdminOfficeSiteView(APIView):
    permission_classes = [IsSuperAdmin]

    def _site(self, request) -> OfficeSite:
        site = OfficeSite.objects.filter(organization=request.user.organization, is_active=True).first()
        if site is None:
            site = OfficeSite.objects.create(organization=request.user.organization, name="Office")
        return site

    def get(self, request):
        return Response(OfficeSiteSerializer(self._site(request)).data)

    def patch(self, request):
        site = self._site(request)
        before = OfficeSiteSerializer(site).data
        s = OfficeSiteSerializer(site, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        audit(actor=request.user, action="OFFICE_SITE_UPDATED", entity=site, before=dict(before), after=dict(s.data), request=request)
        return Response(s.data)
