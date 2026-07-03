from django.utils import timezone
from rest_framework import serializers

from attendance.models import Attendance
from attendance.services import (
    calculate_late_minutes,
    calculate_total_work_hours,
    get_company_start_time,
    get_today,
    resolve_status,
)
from employees.models import Employee


class AttendanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(read_only=True)
    employee_name = serializers.CharField(read_only=True)
    department = serializers.CharField(read_only=True)

    class Meta:
        model = Attendance
        fields = (
            'id',
            'employee',
            'employee_code',
            'employee_name',
            'department',
            'date',
            'check_in_time',
            'check_out_time',
            'work_mode',
            'status',
            'total_work_hours',
            'late_minutes',
            'remarks',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'employee_code',
            'employee_name',
            'department',
            'total_work_hours',
            'late_minutes',
            'created_at',
            'updated_at',
        )


class AttendanceCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = (
            'employee',
            'date',
            'check_in_time',
            'check_out_time',
            'work_mode',
            'status',
            'remarks',
        )

    def validate(self, attrs):
        employee = attrs.get('employee') or (self.instance.employee if self.instance else None)
        date = attrs.get('date') or (self.instance.date if self.instance else None)

        if not self.instance:
            if Attendance.objects.filter(employee=employee, date=date).exists():
                raise serializers.ValidationError(
                    {'date': 'Attendance already exists for this employee on this date.'}
                )

        check_in = attrs.get('check_in_time', getattr(self.instance, 'check_in_time', None))
        check_out = attrs.get('check_out_time', getattr(self.instance, 'check_out_time', None))

        if check_out and not check_in:
            raise serializers.ValidationError({'check_out_time': 'Check-out requires a check-in time.'})

        if check_in and check_out and check_out <= check_in:
            raise serializers.ValidationError({'check_out_time': 'Check-out must be after check-in.'})

        return attrs

    def create(self, validated_data):
        attendance = super().create(validated_data)
        self._apply_calculations(attendance)
        attendance.save()
        return attendance

    def update(self, instance, validated_data):
        attendance = super().update(instance, validated_data)
        self._apply_calculations(attendance)
        attendance.save()
        return attendance

    def _apply_calculations(self, attendance):
        company_start = get_company_start_time()
        if attendance.check_in_time:
            attendance.late_minutes = calculate_late_minutes(
                attendance.check_in_time,
                company_start,
            )
        if attendance.check_in_time and attendance.check_out_time:
            attendance.total_work_hours = calculate_total_work_hours(
                attendance.check_in_time,
                attendance.check_out_time,
            )
            if attendance.status not in {
                Attendance.Status.HALF_DAY,
                Attendance.Status.ON_LEAVE,
                Attendance.Status.HOLIDAY,
                Attendance.Status.ABSENT,
            }:
                attendance.status = resolve_status(
                    attendance.late_minutes,
                    bool(attendance.check_in_time),
                    bool(attendance.check_out_time),
                )


class CheckInSerializer(serializers.Serializer):
    work_mode = serializers.ChoiceField(choices=Attendance.WorkMode.choices)


class CheckOutSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True)


class AttendanceSummarySerializer(serializers.Serializer):
    total_records = serializers.IntegerField()
    present = serializers.IntegerField()
    absent = serializers.IntegerField()
    late = serializers.IntegerField()
    half_day = serializers.IntegerField()
    on_leave = serializers.IntegerField()
    holiday = serializers.IntegerField()
    total_work_hours = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_late_minutes = serializers.IntegerField()
