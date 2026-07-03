from django.contrib import admin

from settings_app.models import CompanyHoliday, CompanySettings


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
