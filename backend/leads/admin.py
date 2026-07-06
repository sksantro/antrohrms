from django.contrib import admin

from leads.models import Lead, LeadContact


class LeadContactInline(admin.TabularInline):
    model = LeadContact
    extra = 0


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        'company_name',
        'country',
        'industry',
        'service_fit',
        'current_status',
        'created_by',
        'created_at',
    )
    list_filter = ('service_fit', 'current_status', 'country')
    search_fields = ('company_name', 'industry', 'country')
    inlines = [LeadContactInline]


@admin.register(LeadContact)
class LeadContactAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'designation', 'lead', 'email', 'phone')
    search_fields = ('full_name', 'email', 'lead__company_name')
