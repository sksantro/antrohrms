from django.contrib import admin

from settings_app.models import (
    CompanyHoliday,
    CompanySettings,
    DepartmentMaster,
    DesignationMaster,
    LeaveTypeMaster,
    PolicyCategoryMaster,
)


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'office_start_time', 'office_end_time', 'updated_at')

    def has_add_permission(self, request):
        if CompanySettings.objects.exists():
            return False
        return super().has_add_permission(request)


@admin.register(CompanyHoliday)
class CompanyHolidayAdmin(admin.ModelAdmin):
    list_display = ('name', 'date', 'holiday_type', 'is_active', 'updated_at')
    list_filter = ('is_active', 'holiday_type')
    search_fields = ('name',)
    ordering = ('date',)


@admin.register(DepartmentMaster)
class DepartmentMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(DesignationMaster)
class DesignationMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'department', 'is_active', 'updated_at')
    list_filter = ('is_active', 'department')
    search_fields = ('name',)


@admin.register(LeaveTypeMaster)
class LeaveTypeMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'annual_quota', 'is_paid', 'is_active', 'updated_at')
    list_filter = ('is_active', 'is_paid')
    search_fields = ('name', 'code')


@admin.register(PolicyCategoryMaster)
class PolicyCategoryMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'code')
