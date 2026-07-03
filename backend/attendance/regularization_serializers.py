from rest_framework import serializers

from attendance.models import AttendanceRegularization
from attendance.regularization_services import validate_regularization_date
from leaves.services.notifications import notify_regularization_applied


class AttendanceRegularizationSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(read_only=True)
    employee_name = serializers.CharField(read_only=True)

    class Meta:
        model = AttendanceRegularization
        fields = (
            'id',
            'employee',
            'employee_code',
            'employee_name',
            'date',
            'requested_check_in',
            'requested_check_out',
            'reason',
            'status',
            'is_backdated',
            'approved_by',
            'approved_at',
            'rejected_by',
            'rejected_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class AttendanceRegularizationApplySerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRegularization
        fields = ('date', 'requested_check_in', 'requested_check_out', 'reason')

    def validate(self, attrs):
        request = self.context.get('request')
        is_hr = bool(
            request
            and request.user.is_authenticated
            and (request.user.is_super_admin or request.user.is_hr_admin),
        )
        is_backdated = validate_regularization_date(attrs['date'], is_hr=is_hr)
        attrs['is_backdated'] = is_backdated
        if not attrs.get('requested_check_in') and not attrs.get('requested_check_out'):
            raise serializers.ValidationError('Check-in or check-out time is required.')
        return attrs

    def create(self, validated_data):
        employee = self.context['employee']
        regularization = AttendanceRegularization.objects.create(
            employee=employee,
            **validated_data,
            status=AttendanceRegularization.Status.PENDING,
        )
        notify_regularization_applied(regularization)
        return regularization


class RegularizationRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField()

    def validate_rejection_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Rejection reason is required.')
        return value.strip()
