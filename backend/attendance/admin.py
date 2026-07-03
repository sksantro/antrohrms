from django.contrib import admin

from attendance.models import Attendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = (
        'employee',
        'date',
        'check_in_time',
        'check_out_time',
        'work_mode',
        'status',
        'total_work_hours',
        'late_minutes',
    )
    list_filter = ('status', 'work_mode', 'date')
    search_fields = ('employee__employee_code', 'employee__first_name', 'employee__last_name')
    raw_id_fields = ('employee',)
