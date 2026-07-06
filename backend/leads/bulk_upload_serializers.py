from rest_framework import serializers

from leads.models import LeadImportHistory


class LeadImportHistorySerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)

    class Meta:
        model = LeadImportHistory
        fields = (
            'id',
            'file_name',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
            'total_rows',
            'imported_rows',
            'skipped_rows',
            'failed_rows',
            'sheet_name',
            'error_details',
        )
        read_only_fields = fields


class LeadBulkUploadPreviewRequestSerializer(serializers.Serializer):
    upload_id = serializers.UUIDField()
    sheet_name = serializers.CharField()
    mapping = serializers.DictField(child=serializers.CharField(allow_blank=True))


class LeadBulkUploadImportRequestSerializer(LeadBulkUploadPreviewRequestSerializer):
    skip_duplicates = serializers.BooleanField(default=True)
