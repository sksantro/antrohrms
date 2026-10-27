"""Employee serializers. None of these contain compensation — salary lives only in payroll admin endpoints."""
from rest_framework import serializers

from accounts.models import Role

from .models import Department, Employee


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]


class _Ref(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()


class EmployeeSerializer(serializers.ModelSerializer):
    """Operational view used by Super Admin, HR and the employee themself."""

    department = DepartmentSerializer(read_only=True)
    reporting_manager = _Ref(read_only=True)
    probation_end = serializers.DateField(read_only=True)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id", "employee_code", "display_name", "official_email", "phone", "department", "designation",
            "reporting_manager", "employment_type", "start_date", "probation_months", "probation_end", "status", "roles",
        ]

    def get_roles(self, obj):
        return sorted(r.role for r in obj.user.role_assignments.all())


class EmployeeSelfSerializer(EmployeeSerializer):
    """Adds personal fields that only the employee and Super Admin see."""

    class Meta(EmployeeSerializer.Meta):
        fields = EmployeeSerializer.Meta.fields + ["address", "emergency_contact"]


class EmployeeCreateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=120)
    official_email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department_id = serializers.UUIDField()
    designation = serializers.CharField(max_length=120)
    reporting_manager_id = serializers.UUIDField(required=False, allow_null=True)
    employment_type = serializers.ChoiceField(choices=Employee.EmploymentType.choices, default=Employee.EmploymentType.FULL_TIME)
    start_date = serializers.DateField()
    status = serializers.ChoiceField(choices=[Employee.Status.PREBOARDING, Employee.Status.PROBATION, Employee.Status.ACTIVE_CONFIRMED], default=Employee.Status.PROBATION)
    roles = serializers.ListField(child=serializers.ChoiceField(choices=Role.choices), required=False, default=list)

    def validate(self, attrs):
        org = self.context["request"].user.organization
        if not Department.objects.filter(pk=attrs["department_id"], organization=org).exists():
            raise serializers.ValidationError({"department_id": ["Unknown department."]})
        mgr = attrs.get("reporting_manager_id")
        if mgr and not Employee.objects.filter(pk=mgr, organization=org).exists():
            raise serializers.ValidationError({"reporting_manager_id": ["Unknown reporting manager."]})
        return attrs


# Which fields each actor may PATCH (BRD §27.1 Employee Profile).
EDITABLE = {
    Role.SUPER_ADMIN: {"display_name", "phone", "department_id", "designation", "reporting_manager_id", "employment_type", "start_date", "probation_months", "status", "address", "emergency_contact"},
    Role.HR_OPERATIONS: {"display_name", "phone", "department_id", "designation", "reporting_manager_id", "employment_type", "start_date"},
    "SELF": {"phone", "address", "emergency_contact"},
}


class EmployeeUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=120, required=False)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department_id = serializers.UUIDField(required=False)
    designation = serializers.CharField(max_length=120, required=False)
    reporting_manager_id = serializers.UUIDField(required=False, allow_null=True)
    employment_type = serializers.ChoiceField(choices=Employee.EmploymentType.choices, required=False)
    start_date = serializers.DateField(required=False)
    probation_months = serializers.IntegerField(min_value=0, max_value=12, required=False)
    status = serializers.ChoiceField(choices=Employee.Status.choices, required=False)
    address = serializers.CharField(required=False, allow_blank=True)
    emergency_contact = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False)
