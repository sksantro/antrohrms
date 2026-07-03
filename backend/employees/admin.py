from django.contrib import admin

from employees.models import Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        'employee_code',
        'first_name',
        'last_name',
        'email',
        'department',
        'designation',
        'status',
        'reporting_manager',
    )
    list_filter = ('status', 'department', 'employment_type')
    search_fields = ('employee_code', 'first_name', 'last_name', 'email')
    readonly_fields = ('employee_code', 'created_at', 'updated_at')
    raw_id_fields = ('user', 'reporting_manager')
