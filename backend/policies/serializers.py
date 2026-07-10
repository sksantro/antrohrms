from rest_framework import serializers
import json

from policies.models import Policy, PolicyAcknowledgement


class PolicySerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(read_only=True)
    policy_file_url = serializers.SerializerMethodField()
    acknowledgement_status = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    applies_to_label = serializers.CharField(source='get_applies_to_display', read_only=True)
    employee_acknowledged_at = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = (
            'id',
            'title',
            'category',
            'version',
            'description',
            'policy_content',
            'policy_file',
            'policy_file_url',
            'effective_date',
            'status',
            'status_label',
            'is_active',
            'applies_to',
            'applies_to_label',
            'applies_to_departments',
            'applies_to_designations',
            'applies_to_employees',
            'requires_acknowledgement',
            'created_by',
            'created_by_name',
            'acknowledgement_status',
            'employee_acknowledged_at',
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

    def get_employee_acknowledged_at(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        profile = getattr(request.user, 'employee_profile', None)
        if not profile:
            return None
        ack = PolicyAcknowledgement.objects.filter(
            policy=obj,
            employee=profile,
            policy_version=obj.version,
            status=PolicyAcknowledgement.Status.ACKNOWLEDGED,
        ).first()
        return ack.acknowledged_at if ack else None

    def validate(self, attrs):
        for key in (
            'applies_to_departments',
            'applies_to_designations',
            'applies_to_employees',
        ):
            value = attrs.get(key, None)
            if isinstance(value, str):
                try:
                    attrs[key] = json.loads(value)
                except json.JSONDecodeError as exc:
                    raise serializers.ValidationError({key: 'Invalid JSON list.'}) from exc

        if self.instance is None and not attrs.get('policy_file'):
            if not attrs.get('policy_content'):
                raise serializers.ValidationError(
                    {'policy_file': 'Policy document or content is required.'}
                )
        if not attrs.get('title', getattr(self.instance, 'title', None)):
            raise serializers.ValidationError({'title': 'Title is required.'})
        if not attrs.get('category', getattr(self.instance, 'category', None)):
            raise serializers.ValidationError({'category': 'Category is required.'})
        if not attrs.get('version', getattr(self.instance, 'version', None)):
            raise serializers.ValidationError({'version': 'Version is required.'})

        applies_to = attrs.get('applies_to', getattr(self.instance, 'applies_to', None))
        applies_to_departments = attrs.get(
            'applies_to_departments',
            getattr(self.instance, 'applies_to_departments', []),
        )
        applies_to_designations = attrs.get(
            'applies_to_designations',
            getattr(self.instance, 'applies_to_designations', []),
        )
        applies_to_employees = attrs.get(
            'applies_to_employees',
            getattr(self.instance, 'applies_to_employees', []),
        )

        if applies_to == Policy.AppliesTo.DEPARTMENT and not applies_to_departments:
            raise serializers.ValidationError(
                {'applies_to_departments': 'Select at least one department.'}
            )
        if applies_to == Policy.AppliesTo.DESIGNATION and not applies_to_designations:
            raise serializers.ValidationError(
                {'applies_to_designations': 'Select at least one designation.'}
            )
        if applies_to == Policy.AppliesTo.SPECIFIC_EMPLOYEES and not applies_to_employees:
            raise serializers.ValidationError(
                {'applies_to_employees': 'Select at least one employee.'}
            )

        return attrs


class PolicyAcknowledgementSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(read_only=True)
    employee_name = serializers.CharField(read_only=True)
    employee_email = serializers.EmailField(source='employee.email', read_only=True)
    employee_department = serializers.CharField(source='employee.department', read_only=True)
    employee_designation = serializers.CharField(source='employee.designation', read_only=True)
    policy_title = serializers.CharField(read_only=True)
    policy_category = serializers.CharField(source='policy.category', read_only=True)
    policy_effective_date = serializers.DateField(source='policy.effective_date', read_only=True)
    policy_status = serializers.CharField(source='policy.status', read_only=True)
    proof_reference = serializers.SerializerMethodField()

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
            'employee_email',
            'employee_department',
            'employee_designation',
            'policy_version',
            'status',
            'acknowledged_at',
            'ip_address',
            'user_agent',
            'confirmation_text',
            'policy_effective_date',
            'policy_status',
            'proof_reference',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_proof_reference(self, obj):
        return f'ACK-{obj.id}-{obj.policy_version}'


class PolicyPendingSummarySerializer(serializers.Serializer):
    total_active_policies = serializers.IntegerField()
    total_active_employees = serializers.IntegerField()
    pending_acknowledgements = serializers.IntegerField()
    acknowledged_count = serializers.IntegerField()
    policy_compliance = serializers.ListField()
    employee_pending = serializers.ListField()
