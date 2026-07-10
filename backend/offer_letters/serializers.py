from django.utils import timezone
from rest_framework import serializers

from employees.models import Employee
from offer_letters.models import OfferLetter
from offer_letters.services import build_offer_document_html, mark_offer_expired_if_needed
from settings_app.models import CompanySettings


class OfferLetterSerializer(serializers.ModelSerializer):
    reporting_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source='reporting_manager',
        required=False,
        allow_null=True,
        write_only=True,
    )
    reporting_manager_display = serializers.SerializerMethodField(read_only=True)
    acceptance_url = serializers.SerializerMethodField(read_only=True)
    preview_html = serializers.SerializerMethodField(read_only=True)
    company_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = OfferLetter
        fields = (
            'id',
            'offer_id',
            'candidate_name',
            'email',
            'phone',
            'department',
            'designation',
            'reporting_manager_id',
            'reporting_manager_name',
            'reporting_manager_display',
            'work_location',
            'joining_date',
            'employment_type',
            'offered_ctc',
            'offer_valid_till',
            'terms_and_conditions',
            'notes',
            'status',
            'acceptance_token',
            'acceptance_url',
            'sent_at',
            'accepted_at',
            'rejected_at',
            'accepted_document_snapshot',
            'preview_html',
            'company_name',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'offer_id',
            'status',
            'acceptance_token',
            'acceptance_url',
            'sent_at',
            'accepted_at',
            'rejected_at',
            'accepted_document_snapshot',
            'preview_html',
            'company_name',
            'created_at',
            'updated_at',
        )

    def get_reporting_manager_display(self, obj):
        if obj.reporting_manager:
            return obj.reporting_manager.full_name
        return obj.reporting_manager_name or None

    def get_acceptance_url(self, obj):
        return f'/offer/accept/{obj.acceptance_token}'

    def get_preview_html(self, obj):
        company_name = CompanySettings.get_settings().company_name
        return build_offer_document_html(obj, company_name)

    def get_company_name(self, obj):
        return CompanySettings.get_settings().company_name

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        reporting_manager = attrs.get('reporting_manager')
        if reporting_manager:
            attrs['reporting_manager_name'] = reporting_manager.full_name
        return attrs


class OfferLetterCreateUpdateSerializer(OfferLetterSerializer):
    class Meta(OfferLetterSerializer.Meta):
        read_only_fields = (
            'id',
            'offer_id',
            'status',
            'acceptance_token',
            'acceptance_url',
            'sent_at',
            'accepted_at',
            'rejected_at',
            'accepted_document_snapshot',
            'preview_html',
            'company_name',
            'created_at',
            'updated_at',
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = getattr(self, 'instance', None)
        if instance and instance.status not in {
            OfferLetter.Status.DRAFT,
            OfferLetter.Status.SENT,
        }:
            raise serializers.ValidationError(
                'Only draft or sent offers can be edited.',
            )
        return attrs


class OfferLetterPublicSerializer(serializers.ModelSerializer):
    preview_html = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    can_respond = serializers.SerializerMethodField()

    class Meta:
        model = OfferLetter
        fields = (
            'offer_id',
            'candidate_name',
            'email',
            'department',
            'designation',
            'work_location',
            'joining_date',
            'employment_type',
            'offered_ctc',
            'offer_valid_till',
            'terms_and_conditions',
            'status',
            'preview_html',
            'company_name',
            'can_respond',
            'accepted_at',
            'rejected_at',
        )

    def get_preview_html(self, obj):
        company_name = CompanySettings.get_settings().company_name
        return build_offer_document_html(obj, company_name)

    def get_company_name(self, obj):
        return CompanySettings.get_settings().company_name

    def get_can_respond(self, obj):
        mark_offer_expired_if_needed(obj)
        return obj.status == OfferLetter.Status.SENT and obj.offer_valid_till >= timezone.localdate()


class OfferLetterSendResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    email_sent = serializers.BooleanField()
    status = serializers.CharField()
