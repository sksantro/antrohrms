from rest_framework import serializers

from leaves.models import LeaveBalance, LeaveRequest
from leaves.services import on_leave_applied, validate_apply_request


class LeaveBalanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)

    class Meta:
        model = LeaveBalance
        fields = (
            'id',
            'employee',
            'employee_code',
            'employee_name',
            'year',
            'paid_leave_balance',
            'paid_leave_earned',
            'paid_leave_used',
            'lop_days',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'paid_leave_earned',
            'paid_leave_used',
            'lop_days',
            'created_at',
            'updated_at',
        )


class LeaveBalanceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveBalance
        fields = ('paid_leave_balance',)


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(read_only=True)
    employee_name = serializers.CharField(read_only=True)
    approved_by_name = serializers.CharField(read_only=True)
    rejected_by_name = serializers.CharField(read_only=True)
    pending_days = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = (
            'id',
            'employee',
            'employee_code',
            'employee_name',
            'leave_type',
            'start_date',
            'end_date',
            'total_working_days',
            'half_day',
            'half_day_session',
            'reason',
            'status',
            'approval_level',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'rejected_by',
            'rejected_by_name',
            'rejected_at',
            'rejection_reason',
            'escalated_to_hr',
            'escalated_at',
            'is_backdated',
            'is_special_approval_required',
            'lop_days',
            'paid_leave_days',
            'pending_days',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_pending_days(self, obj):
        if obj.status != LeaveRequest.Status.PENDING:
            return 0
        from django.utils import timezone
        return (timezone.now() - obj.created_at).days


class LeaveApplySerializer(serializers.Serializer):
    leave_type = serializers.ChoiceField(choices=LeaveRequest.LeaveType.choices)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    half_day = serializers.BooleanField(default=False)
    half_day_session = serializers.ChoiceField(
        choices=LeaveRequest.HalfDaySession.choices,
        required=False,
        allow_blank=True,
    )
    reason = serializers.CharField()

    def validate(self, attrs):
        employee = self.context['employee']
        request = self.context.get('request')
        is_hr = bool(
            request
            and request.user.is_authenticated
            and (request.user.is_super_admin or request.user.is_hr_admin),
        )
        try:
            meta = validate_apply_request(
                employee,
                attrs['leave_type'],
                attrs['start_date'],
                attrs['end_date'],
                half_day=attrs.get('half_day', False),
                half_day_session=attrs.get('half_day_session', ''),
                is_hr=is_hr,
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        attrs.update(meta)
        return attrs

    def create(self, validated_data):
        employee = self.context['employee']
        meta_keys = {
            'total_working_days',
            'paid_leave_days',
            'lop_days',
            'is_backdated',
            'is_special_approval_required',
        }
        meta = {k: validated_data.pop(k) for k in meta_keys}
        leave_request = LeaveRequest.objects.create(
            employee=employee,
            leave_type=validated_data['leave_type'],
            start_date=validated_data['start_date'],
            end_date=validated_data['end_date'],
            half_day=validated_data.get('half_day', False),
            half_day_session=validated_data.get('half_day_session', ''),
            reason=validated_data['reason'],
            status=LeaveRequest.Status.PENDING,
            **meta,
        )
        on_leave_applied(leave_request)
        return leave_request


class LeaveRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField()

    def validate_rejection_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Rejection reason is required.')
        return value.strip()
