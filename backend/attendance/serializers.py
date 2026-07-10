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
    employee_email = serializers.EmailField(source='employee.email', read_only=True)
    department = serializers.CharField(read_only=True)
    regularization_status = serializers.SerializerMethodField()
    late_status = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = (
            'id',
            'employee',
            'employee_code',
            'employee_name',
            'employee_email',
            'department',
            'date',
            'check_in_time',
            'check_out_time',
            'work_mode',
            'status',
            'display_status',
            'late_status',
            'regularization_status',
            'total_work_hours',
            'late_minutes',
            'remarks',
            'daily_report_summary',
            'tomorrow_plan',
            'kpi_snapshot',
            'kpi_miss_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'employee_code',
            'employee_name',
            'employee_email',
            'department',
            'display_status',
            'late_status',
            'regularization_status',
            'total_work_hours',
            'late_minutes',
            'created_at',
            'updated_at',
        )

    def get_regularization_status(self, obj):
        from attendance.models import AttendanceRegularization

        regularization = (
            AttendanceRegularization.objects.filter(employee_id=obj.employee_id, date=obj.date)
            .order_by('-created_at')
            .first()
        )
        return regularization.status if regularization else None

    def get_late_status(self, obj):
        if obj.status == Attendance.Status.LATE or obj.late_minutes > 0:
            return 'Late'
        if obj.check_in_time:
            return 'On Time'
        return '—'

    def get_display_status(self, obj):
        if obj.status == Attendance.Status.MISSING_CHECKOUT or (
            obj.check_in_time
            and not obj.check_out_time
            and obj.status
            not in {
                Attendance.Status.ON_LEAVE,
                Attendance.Status.HOLIDAY,
                Attendance.Status.ABSENT,
            }
        ):
            return 'MISSING_PUNCH'
        return obj.status


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


class DailyReportSummarySerializer(serializers.Serializer):
    work_summary_today = serializers.CharField()
    key_companies_worked_on = serializers.CharField()
    interested_leads_summary = serializers.CharField()
    meetings_demo_updates = serializers.CharField()
    issues_blockers = serializers.CharField()

    def validate(self, attrs):
        for field, value in attrs.items():
            if not str(value).strip():
                raise serializers.ValidationError({field: 'This field is required.'})
        return attrs


class CheckOutSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True)
    daily_report_summary = DailyReportSummarySerializer(required=False)
    tomorrow_plan = serializers.CharField(required=False, allow_blank=True)
    kpi_miss_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        from attendance.sales_checkout import is_sales_marketing_user
        from leads.kpi import get_daily_kpi_summary

        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if not is_sales_marketing_user(user):
            attrs.pop('daily_report_summary', None)
            attrs.pop('tomorrow_plan', None)
            attrs.pop('kpi_miss_reason', None)
            return attrs

        report = attrs.get('daily_report_summary')
        if not report:
            raise serializers.ValidationError({
                'daily_report_summary': 'Daily report is required for Sales & Marketing checkout.',
            })

        tomorrow_plan = attrs.get('tomorrow_plan', '').strip()
        if not tomorrow_plan:
            raise serializers.ValidationError({
                'tomorrow_plan': 'Tomorrow plan is required for Sales & Marketing checkout.',
            })
        attrs['tomorrow_plan'] = tomorrow_plan

        kpi_snapshot = get_daily_kpi_summary(user)
        has_unmatched_kpi = any(
            metric['status'] == 'Not Matched' for metric in kpi_snapshot['metrics']
        )
        kpi_miss_reason = attrs.get('kpi_miss_reason', '').strip()
        if has_unmatched_kpi and not kpi_miss_reason:
            raise serializers.ValidationError({
                'kpi_miss_reason': 'KPI miss reason is required when daily targets are not matched.',
            })
        attrs['kpi_miss_reason'] = kpi_miss_reason
        return attrs


class AttendanceSummarySerializer(serializers.Serializer):
    total_records = serializers.IntegerField()
    present = serializers.IntegerField()
    absent = serializers.IntegerField()
    late = serializers.IntegerField()
    half_day = serializers.IntegerField()
    on_leave = serializers.IntegerField()
    holiday = serializers.IntegerField()
    missing_punch = serializers.IntegerField()
    total_work_hours = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_late_minutes = serializers.IntegerField()
