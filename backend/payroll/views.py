from decimal import Decimal

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from common.errors import BusinessRuleError, ConflictError
from common.services import audit
from employees.models import Employee

from .models import SalaryVersion


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
