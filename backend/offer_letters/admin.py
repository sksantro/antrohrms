from django.contrib import admin

from offer_letters.models import OfferLetter


@admin.register(OfferLetter)
class OfferLetterAdmin(admin.ModelAdmin):
    list_display = (
        'offer_id',
        'candidate_name',
        'email',
        'department',
        'designation',
        'status',
        'joining_date',
        'created_at',
    )
    list_filter = ('status', 'department', 'employment_type')
    search_fields = ('offer_id', 'candidate_name', 'email')
    readonly_fields = ('offer_id', 'acceptance_token', 'created_at', 'updated_at')
