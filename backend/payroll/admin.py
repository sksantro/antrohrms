from django.contrib import admin

from payroll.models import EmployeePayrollDraft, EmployeePayrollProfile, PayrollRun, SalaryStructure


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = (
        'employee',
        'effective_from',
        'monthly_gross_salary',
        'is_active',
        'updated_at',
    )
    list_filter = ('is_active', 'effective_from')
    search_fields = ('employee__employee_code', 'employee__first_name', 'employee__last_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ('month', 'year', 'status', 'total_employees', 'generated_at')
    list_filter = ('status', 'year', 'month')
    readonly_fields = ('created_at', 'updated_at', 'generated_at')


@admin.register(EmployeePayrollDraft)
class EmployeePayrollDraftAdmin(admin.ModelAdmin):
    list_display = ('payroll_run', 'employee', 'net_pay', 'remarks')
    search_fields = ('employee__employee_code', 'employee__first_name', 'employee__last_name')


@admin.register(EmployeePayrollProfile)
class EmployeePayrollProfileAdmin(admin.ModelAdmin):
    list_display = ('employee', 'pan_number', 'bank_name', 'is_active', 'updated_at')
    search_fields = ('employee__employee_code', 'pan_number', 'account_holder_name')
    readonly_fields = ('created_at', 'updated_at')
