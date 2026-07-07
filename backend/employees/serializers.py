from django.db import transaction
from rest_framework import serializers

from accounts.models import User
from accounts.utils import generate_temporary_password
from employees.models import Employee


class ReportingManagerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ('id', 'employee_code', 'first_name', 'last_name', 'email')


class EmployeeBasicSerializer(serializers.ModelSerializer):
    reporting_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = (
            'id',
            'employee_code',
            'first_name',
            'last_name',
            'email',
            'phone',
            'department',
            'designation',
            'status',
            'reporting_manager_name',
        )

    def get_reporting_manager_name(self, obj):
        if obj.reporting_manager:
            return obj.reporting_manager.full_name
        return None


class EmployeeSerializer(serializers.ModelSerializer):
    reporting_manager = ReportingManagerSerializer(read_only=True)
    reporting_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source='reporting_manager',
        write_only=True,
        required=False,
        allow_null=True,
    )
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = (
            'id',
            'employee_code',
            'first_name',
            'last_name',
            'full_name',
            'email',
            'phone',
            'alternate_phone',
            'gender',
            'date_of_birth',
            'joining_date',
            'department',
            'designation',
            'reporting_manager',
            'reporting_manager_id',
            'employment_type',
            'work_location',
            'status',
            'address',
            'emergency_contact_name',
            'emergency_contact_phone',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'employee_code', 'created_at', 'updated_at')


class EmployeeCreateSerializer(serializers.ModelSerializer):
    reporting_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source='reporting_manager',
        required=False,
        allow_null=True,
    )
    user_role = serializers.ChoiceField(
        choices=User.Role.choices,
        default=User.Role.EMPLOYEE,
        write_only=True,
    )

    class Meta:
        model = Employee
        fields = (
            'first_name',
            'last_name',
            'email',
            'phone',
            'alternate_phone',
            'gender',
            'date_of_birth',
            'joining_date',
            'department',
            'designation',
            'reporting_manager_id',
            'employment_type',
            'work_location',
            'status',
            'address',
            'emergency_contact_name',
            'emergency_contact_phone',
            'user_role',
        )

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        if Employee.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An employee with this email already exists.')
        return email

    def validate_user_role(self, value):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_hr_admin and not user.is_super_admin:
            if value != User.Role.EMPLOYEE:
                raise serializers.ValidationError('HR admins can only assign the Employee role.')
        if value == User.Role.SUPER_ADMIN and not (user and user.is_super_admin):
            raise serializers.ValidationError('Only super admins can assign the Super Admin role.')
        return value

    @transaction.atomic
    def create(self, validated_data):
        user_role = validated_data.pop('user_role', User.Role.EMPLOYEE)
        full_name = f"{validated_data['first_name']} {validated_data['last_name']}".strip()
        temporary_password = generate_temporary_password()

        user = User.objects.create_user(
            email=validated_data['email'],
            password=temporary_password,
            full_name=full_name,
            phone=validated_data.get('phone', ''),
            role=user_role,
            must_change_password=True,
        )

        employee = Employee.objects.create(
            user=user,
            **validated_data,
        )
        employee.temporary_password = temporary_password
        return employee


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    reporting_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source='reporting_manager',
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Employee
        fields = (
            'first_name',
            'last_name',
            'phone',
            'alternate_phone',
            'gender',
            'date_of_birth',
            'joining_date',
            'department',
            'designation',
            'reporting_manager_id',
            'employment_type',
            'work_location',
            'status',
            'address',
            'emergency_contact_name',
            'emergency_contact_phone',
        )

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        user = instance.user
        user.full_name = instance.full_name
        user.phone = instance.phone
        user.is_active = instance.status == Employee.Status.ACTIVE
        user.save(update_fields=['full_name', 'phone', 'is_active', 'updated_at'])
        return instance
