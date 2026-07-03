from rest_framework import serializers

from policies.models import Policy, PolicyAcknowledgement


class PolicySerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(read_only=True)
    policy_file_url = serializers.SerializerMethodField()
    acknowledgement_status = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = (
            'id',
            'title',
            'category',
            'version',
            'description',
            'policy_file',
            'policy_file_url',
            'effective_date',
            'is_active',
            'created_by',
            'created_by_name',
            'acknowledgement_status',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'created_by_name', 'created_at', 'updated_at')

    def get_policy_file_url(self, obj):
        if not obj.policy_file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.policy_file.url)
        return obj.policy_file.url

    def get_acknowledgement_status(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        profile = getattr(request.user, 'employee_profile', None)
        if not profile:
            return None
        from policies.services import get_employee_acknowledgement_status

        return get_employee_acknowledgement_status(obj, profile)

    def validate(self, attrs):
        if self.instance is None and not attrs.get('policy_file'):
            raise serializers.ValidationError({'policy_file': 'Policy file is required.'})
        if not attrs.get('title', getattr(self.instance, 'title', None)):
            raise serializers.ValidationError({'title': 'Title is required.'})
        if not attrs.get('category', getattr(self.instance, 'category', None)):
            raise serializers.ValidationError({'category': 'Category is required.'})
        if not attrs.get('version', getattr(self.instance, 'version', None)):
            raise serializers.ValidationError({'version': 'Version is required.'})
        return attrs


class PolicyAcknowledgementSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(read_only=True)
    employee_name = serializers.CharField(read_only=True)
    policy_title = serializers.CharField(read_only=True)
    policy_category = serializers.CharField(source='policy.category', read_only=True)

    class Meta:
        model = PolicyAcknowledgement
        fields = (
            'id',
            'policy',
            'policy_title',
            'policy_category',
            'employee',
            'employee_code',
            'employee_name',
            'policy_version',
            'status',
            'acknowledged_at',
            'ip_address',
            'user_agent',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class PolicyPendingSummarySerializer(serializers.Serializer):
    total_active_policies = serializers.IntegerField()
    total_active_employees = serializers.IntegerField()
    pending_acknowledgements = serializers.IntegerField()
    acknowledged_count = serializers.IntegerField()
    policy_compliance = serializers.ListField()
    employee_pending = serializers.ListField()
