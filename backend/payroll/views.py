from decimal import Decimal

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from common.errors import BusinessRuleError, ConflictError
from common.services import audit
from employees.models import Employee

from . import services as pay
from .models import PayrollRun, Payslip, SalaryVersion


class ComponentSerializer(serializers.Serializer):
    code = serializers.RegexField(r"^[A-Z0-9_]{2,20}$")
    name = serializers.CharField(max_length=80)
    type = serializers.ChoiceField(choices=["EARNING", "DEDUCTION", "EMPLOYER_ONLY"])
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))


class SalaryVersionSerializer(serializers.ModelSerializer):
    components = ComponentSerializer(many=True)
    created_by = serializers.CharField(source="created_by.display_name", read_only=True)

    class Meta:
        model = SalaryVersion
        fields = ["id", "effective_from", "monthly_gross", "components", "note", "created_by", "created_at"]
        read_only_fields = ["id", "created_by", "created_at"]

    def validate(self, attrs):
        earnings = sum((c["amount"] for c in attrs["components"] if c["type"] == "EARNING"), Decimal("0"))
        if earnings != attrs["monthly_gross"]:
            raise serializers.ValidationError({"components": [f"Earnings add up to ₹{earnings}, but monthly gross is ₹{attrs['monthly_gross']}."]})
        codes = [c["code"] for c in attrs["components"]]
        if len(codes) != len(set(codes)):
            raise serializers.ValidationError({"components": ["Each component code can appear only once."]})
        return attrs


class CompensationView(APIView):
    """GET history / POST a new effective-dated version. Super Admin only — HR gets 403 (BRD §19 Privacy)."""

    permission_classes = [IsSuperAdmin]

    def _employee(self, request, employee_id) -> Employee:
        emp = Employee.objects.filter(organization=request.user.organization, pk=employee_id).first()
        if emp is None:
            raise BusinessRuleError("NOT_FOUND", "Employee not found.")
        return emp

    def get(self, request, employee_id):
        emp = self._employee(request, employee_id)
        return Response({"employee_id": str(emp.pk), "versions": SalaryVersionSerializer(emp.salary_versions.select_related("created_by"), many=True).data})

    def post(self, request, employee_id):
        emp = self._employee(request, employee_id)
        s = SalaryVersionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if SalaryVersion.objects.filter(employee=emp, effective_from=s.validated_data["effective_from"]).exists():
            raise ConflictError("EFFECTIVE_DATE_COLLISION", "A salary version already starts on this date. Pick another effective date.")
        components = [{**c, "amount": str(c["amount"])} for c in s.validated_data["components"]]
        sv = SalaryVersion.objects.create(employee=emp, created_by=request.user, **{**s.validated_data, "components": components})
        # Audit records the change but not the amounts, so salary never appears in non-admin logs.
        audit(actor=request.user, action="SALARY_VERSION_CREATED", entity=sv, after={"employee_id": str(emp.pk), "effective_from": str(sv.effective_from)}, request=request, organization=emp.organization)
        return Response(SalaryVersionSerializer(sv).data, status=201)


# ---------- monthly payroll (Super Admin) and payslips (own) ----------


def _run(r: PayrollRun, slips=False) -> dict:
    out = {"id": str(r.id), "year": r.year, "month": r.month, "status": r.status, "warnings": r.warnings, "calculated_at": r.calculated_at,
           "approved_at": r.approved_at, "paid_at": r.paid_at}
    if slips:
        rows = list(r.payslips.select_related("employee"))
        out["payslips"] = [_slip(s, admin=True) for s in rows]
        out["totals"] = {"gross": str(sum((s.gross for s in rows), Decimal("0"))), "deductions": str(sum((s.deductions for s in rows), Decimal("0"))),
                         "net": str(sum((s.net for s in rows), Decimal("0"))), "count": len(rows)}
    return out


def _slip(s: Payslip, admin=False) -> dict:
    out = {"id": str(s.id), "year": s.run.year, "month": s.run.month, "status": s.run.status, "data": s.data, "gross": s.gross,
           "deductions": s.deductions, "net": s.net, "digest": s.digest, "issued_at": s.run.approved_at}
    if admin:
        out |= {"employee_id": str(s.employee_id), "unpaid_days": s.unpaid_days, "adjustments": s.adjustments, "flags": s.flags}
    return out


class RunIn(serializers.Serializer):
    year = serializers.IntegerField(min_value=2020, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)


class AdjustmentIn(serializers.Serializer):
    name = serializers.CharField(max_length=60)
    type = serializers.ChoiceField(choices=["EARNING", "DEDUCTION"])
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    note = serializers.CharField(max_length=200)


class SlipIn(serializers.Serializer):
    unpaid_days = serializers.DecimalField(max_digits=4, decimal_places=1, min_value=Decimal("0"), max_value=Decimal("31"))
    adjustments = AdjustmentIn(many=True)

    def validate_unpaid_days(self, v):
        if v * 2 != int(v * 2):
            raise serializers.ValidationError("Use whole or half days.")
        return v


def _get_run(request, pk) -> PayrollRun:
    r = PayrollRun.objects.filter(organization=request.user.organization, pk=pk).first()
    if r is None:
        raise BusinessRuleError("NOT_FOUND", "Payroll month not found.")
    return r


class PayrollRunsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response({"runs": [_run(r) for r in PayrollRun.objects.filter(organization=request.user.organization)[:36]]})

    def post(self, request):
        s = RunIn(data=request.data)
        s.is_valid(raise_exception=True)
        run = pay.calculate(request.user.organization, s.validated_data["year"], s.validated_data["month"], request.user, request)
        return Response(_run(run, slips=True), status=201)


class PayrollRunView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        return Response(_run(_get_run(request, pk), slips=True))


class PayrollRunActionView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk, action):
        if action not in ("approve", "paid"):
            raise BusinessRuleError("NOT_FOUND", "Unknown action.")
        run = _get_run(request, pk)
        run = pay.approve(run, request.user, request) if action == "approve" else pay.mark_paid(run, request.user, request)
        return Response(_run(run, slips=True))


class PayslipAdjustView(APIView):
    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        slip = Payslip.objects.filter(run__organization=request.user.organization, pk=pk).select_related("run", "employee").first()
        if slip is None:
            raise BusinessRuleError("NOT_FOUND", "Payslip not found.")
        s = SlipIn(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(_slip(pay.adjust(slip, s.validated_data["unpaid_days"], s.validated_data["adjustments"], request.user, request), admin=True))


class MyPayslipsView(APIView):
    """Own payslips from approved months only (BRD §8.5: never before approval)."""

    def get(self, request):
        emp = getattr(request.user, "employee", None)
        if emp is None:
            return Response({"payslips": []})
        qs = Payslip.objects.filter(employee=emp, run__status__in=["APPROVED", "PAID"]).select_related("run").order_by("-run__year", "-run__month")
        return Response({"payslips": [_slip(s) for s in qs]})


class PayslipView(APIView):
    """One payslip: the owner (approved months only) or the Super Admin. Everyone else gets 404, never a hint it exists."""

    def get(self, request, pk):
        s = Payslip.objects.filter(run__organization=request.user.organization, pk=pk).select_related("run", "employee").first()
        admin = request.user.has_role("SUPER_ADMIN")
        mine = s is not None and s.employee.user_id == request.user.pk and s.run.status != "DRAFT"
        if s is None or not (admin or mine):
            raise BusinessRuleError("NOT_FOUND", "Payslip not found.")
        return Response(_slip(s, admin=admin))
