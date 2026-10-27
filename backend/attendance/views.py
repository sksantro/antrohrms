from datetime import date

from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from common.errors import BusinessRuleError
from common.models import OfficeSite
from common.services import audit

from . import services as svc
from .models import AttendanceCorrection, AttendanceDay, AttendanceEvent


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
        day = AttendanceDay.objects.select_related("employee").prefetch_related("events").get(pk=day.pk)
    return Response(svc.summary_payload(day, at, emp.organization), status=status)


class TodayView(APIView):
    def get(self, request):
        return _today_response(_employee(request))


class CheckInView(APIView):
    def post(self, request):
        emp = _employee(request)
        s = LocationInput(data=request.data)
        s.is_valid(raise_exception=True)
        svc.check_in(employee=emp, actor=request.user, location=s.location_obj(), unavailable_reason=s.validated_data.get("location_error", ""), key=_key(request), request=request)
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
        day = svc.open_day(emp)
        state = svc.derive(day.events.all(), svc.now()).state if day else "NOT_CHECKED_IN"
        if state not in ("ON_TEA", "ON_LUNCH"):
            raise BusinessRuleError("NOT_ON_BREAK", "You're not on a break.")
        svc.punch(employee=emp, actor=request.user, type_="END_TEA" if state == "ON_TEA" else "END_LUNCH", key=_key(request))
        return _today_response(emp)


class CheckOutSerializer(LocationInput):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class CheckOutView(APIView):
    def post(self, request):
        emp = _employee(request)
        s = CheckOutSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        svc.check_out(employee=emp, actor=request.user, reason=s.validated_data.get("reason", ""), location=s.location_obj(), key=_key(request), request=request)
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
    return {
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
        days = AttendanceDay.objects.filter(employee=emp, work_date__gte=first, work_date__lt=nxt).prefetch_related("events", "corrections")
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
