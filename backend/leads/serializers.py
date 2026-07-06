from rest_framework import serializers

from leads.models import Lead, LeadActivity, LeadContact, LeadStatusChange
from leads.services import (
    DUPLICATE_WARNING_MESSAGE,
    is_duplicate_activity,
    is_duplicate_remarks_update,
    is_duplicate_status_change,
)


class LeadContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadContact
        fields = (
            'id',
            'lead',
            'full_name',
            'designation',
            'department',
            'linkedin_profile_url',
            'email',
            'phone',
            'location',
            'remarks',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'lead', 'created_at', 'updated_at')


class LeadContactCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadContact
        fields = (
            'full_name',
            'designation',
            'department',
            'linkedin_profile_url',
            'email',
            'phone',
            'location',
            'remarks',
        )

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Full name is required.')
        return value.strip()

    def validate_designation(self, value):
        if not value.strip():
            raise serializers.ValidationError('Designation is required.')
        return value.strip()

    def validate_email(self, value):
        return value.strip() if value else ''

    def validate_linkedin_profile_url(self, value):
        return value.strip() if value else ''


class LeadStatusChangeSerializer(serializers.ModelSerializer):
    previous_status_display = serializers.SerializerMethodField()
    new_status_display = serializers.SerializerMethodField()
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)

    class Meta:
        model = LeadStatusChange
        fields = (
            'id',
            'lead',
            'previous_status',
            'previous_status_display',
            'new_status',
            'new_status_display',
            'remarks',
            'is_countable_for_kpi',
            'changed_by',
            'changed_by_name',
            'changed_at',
        )
        read_only_fields = (
            'id',
            'lead',
            'previous_status',
            'previous_status_display',
            'new_status',
            'new_status_display',
            'remarks',
            'is_countable_for_kpi',
            'changed_by',
            'changed_by_name',
            'changed_at',
        )

    def get_previous_status_display(self, obj):
        if not obj.previous_status:
            return ''
        try:
            return Lead.CurrentStatus(obj.previous_status).label
        except ValueError:
            return obj.previous_status

    def get_new_status_display(self, obj):
        try:
            return Lead.CurrentStatus(obj.new_status).label
        except ValueError:
            return obj.new_status


class LeadActivitySerializer(serializers.ModelSerializer):
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = LeadActivity
        fields = (
            'id',
            'lead',
            'activity_type',
            'activity_type_display',
            'notes',
            'assigned_to',
            'assigned_to_name',
            'due_date',
            'status',
            'status_display',
            'priority',
            'priority_display',
            'completion_notes',
            'completed_at',
            'is_overdue',
            'is_countable_for_kpi',
            'not_counted_reason',
            'is_deleted',
            'edited_at',
            'edited_by',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'lead',
            'created_by',
            'created_by_name',
            'assigned_to_name',
            'status_display',
            'priority_display',
            'is_overdue',
            'completed_at',
            'created_at',
            'updated_at',
        )


class LeadSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    lead_owner_name = serializers.CharField(source='lead_owner.full_name', read_only=True)
    last_updated_by_name = serializers.SerializerMethodField()
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    contact_count = serializers.SerializerMethodField()

    def get_last_updated_by_name(self, obj):
        if obj.last_updated_by_id:
            return obj.last_updated_by.full_name
        return ''

    class Meta:
        model = Lead
        fields = (
            'id',
            'company_name',
            'website',
            'country',
            'industry',
            'company_size',
            'source',
            'service_fit',
            'current_status',
            'priority',
            'priority_display',
            'remarks',
            'next_follow_up_date',
            'last_activity_date',
            'created_by',
            'created_by_name',
            'lead_owner',
            'lead_owner_name',
            'last_updated_by',
            'last_updated_by_name',
            'contact_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'created_by',
            'created_by_name',
            'lead_owner_name',
            'last_updated_by_name',
            'priority_display',
            'last_activity_date',
            'contact_count',
            'created_at',
            'updated_at',
        )

    def get_contact_count(self, obj):
        if hasattr(obj, 'contact_count_value'):
            return obj.contact_count_value
        return obj.contacts.count()


class LeadDetailSerializer(LeadSerializer):
    contacts = LeadContactSerializer(many=True, read_only=True)
    activities = LeadActivitySerializer(many=True, read_only=True)
    status_changes = LeadStatusChangeSerializer(many=True, read_only=True)

    class Meta(LeadSerializer.Meta):
        fields = LeadSerializer.Meta.fields + ('contacts', 'activities', 'status_changes')


class LeadDashboardSerializer(serializers.Serializer):
    stats = serializers.DictField()
    recent_leads = LeadSerializer(many=True)


class LeadCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = (
            'company_name',
            'website',
            'country',
            'industry',
            'company_size',
            'source',
            'service_fit',
            'current_status',
            'priority',
            'remarks',
            'next_follow_up_date',
            'lead_owner',
        )
        extra_kwargs = {
            'lead_owner': {'required': False, 'allow_null': True},
            'next_follow_up_date': {'required': False, 'allow_null': True},
            'company_size': {'required': False, 'allow_blank': True},
            'source': {'required': False, 'allow_blank': True},
        }

    def validate_lead_owner(self, value):
        user = self.context['request'].user
        if value is None:
            return value
        if user.is_super_admin:
            return value
        if value.id != user.id:
            raise serializers.ValidationError('You can only assign leads to yourself.')
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data.setdefault('lead_owner', user)
        validated_data['last_updated_by'] = user
        lead = super().create(validated_data)
        if lead.current_status != Lead.CurrentStatus.NEW:
            LeadStatusChange.objects.create(
                lead=lead,
                previous_status='',
                new_status=lead.current_status,
                remarks=lead.remarks,
                changed_by=user,
            )
        from leads.risk_events import check_leads_without_decision_makers, check_low_lead_quality

        check_low_lead_quality(user, lead)
        check_leads_without_decision_makers(user)
        return lead


class LeadEditSerializer(serializers.ModelSerializer):
    confirm_duplicate = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = Lead
        fields = (
            'company_name',
            'website',
            'country',
            'industry',
            'company_size',
            'source',
            'service_fit',
            'priority',
            'remarks',
            'next_follow_up_date',
            'lead_owner',
            'confirm_duplicate',
        )
        extra_kwargs = {
            'next_follow_up_date': {'required': False, 'allow_null': True},
            'company_size': {'required': False, 'allow_blank': True},
            'source': {'required': False, 'allow_blank': True},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = self.context['request'].user
        if not user.is_super_admin:
            self.fields.pop('lead_owner', None)

    def validate_lead_owner(self, value):
        return value

    def validate(self, attrs):
        instance = self.instance
        confirm_duplicate = attrs.pop('confirm_duplicate', False)
        remarks = attrs.get('remarks', instance.remarks)
        status_changing = any(
            attrs.get(field) != getattr(instance, field)
            for field in ('company_name', 'website', 'country', 'industry', 'service_fit')
        )

        if not status_changing and is_duplicate_remarks_update(instance, remarks):
            if not confirm_duplicate:
                raise serializers.ValidationError({
                    'duplicate_warning': DUPLICATE_WARNING_MESSAGE,
                })
            attrs['_remarks_not_countable'] = True
        else:
            attrs['_remarks_not_countable'] = False

        return attrs

    def update(self, instance, validated_data):
        remarks_not_countable = validated_data.pop('_remarks_not_countable', False)
        previous_remarks = instance.remarks
        user = self.context['request'].user
        validated_data['last_updated_by'] = user
        lead = super().update(instance, validated_data)

        if previous_remarks != lead.remarks:
            LeadStatusChange.objects.create(
                lead=lead,
                previous_status=lead.current_status,
                new_status=lead.current_status,
                remarks=lead.remarks,
                changed_by=self.context['request'].user,
                is_countable_for_kpi=not remarks_not_countable,
            )
            if remarks_not_countable:
                from leads.risk_events import record_same_remark_event

                record_same_remark_event(self.context['request'].user, lead)
        return lead


class LeadChangeStatusSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=Lead.CurrentStatus.choices)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    confirm_duplicate = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        lead = self.context['lead']
        confirm_duplicate = attrs.get('confirm_duplicate', False)
        new_status = attrs['new_status']
        remarks = attrs.get('remarks', '')

        if is_duplicate_status_change(lead, new_status, remarks):
            if not confirm_duplicate:
                raise serializers.ValidationError({
                    'duplicate_warning': DUPLICATE_WARNING_MESSAGE,
                })
            attrs['is_countable_for_kpi'] = False
        else:
            attrs['is_countable_for_kpi'] = True

        return attrs


class LeadActivityCreateSerializer(serializers.ModelSerializer):
    confirm_duplicate = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = LeadActivity
        fields = (
            'activity_type',
            'notes',
            'assigned_to',
            'due_date',
            'priority',
            'confirm_duplicate',
        )

    def validate_assigned_to(self, value):
        user = self.context['request'].user
        if user.is_super_admin:
            return value
        if value.id != user.id:
            raise serializers.ValidationError('You can only assign activities to yourself.')
        return value

    def validate(self, attrs):
        lead = self.context['lead']
        user = self.context['request'].user
        confirm_duplicate = attrs.pop('confirm_duplicate', False)
        activity_type = attrs['activity_type']
        notes = attrs.get('notes', '')

        if is_duplicate_activity(lead, user, activity_type, notes):
            if not confirm_duplicate:
                raise serializers.ValidationError({
                    'duplicate_warning': DUPLICATE_WARNING_MESSAGE,
                })
            attrs['is_countable_for_kpi'] = False
            attrs['not_counted_reason'] = 'Duplicate activity confirmed by user.'
        else:
            attrs['is_countable_for_kpi'] = True
            attrs['not_counted_reason'] = ''

        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['lead'] = self.context['lead']
        validated_data.setdefault('assigned_to', user)
        validated_data.setdefault('status', LeadActivity.Status.OPEN)
        activity = super().create(validated_data)
        from leads.risk_events import check_repeated_remarks_pattern, record_duplicate_activity_event
        from leads.services import touch_lead_last_activity

        if not activity.is_countable_for_kpi:
            record_duplicate_activity_event(user, self.context['lead'], activity)
        check_repeated_remarks_pattern(user)
        touch_lead_last_activity(self.context['lead'], user)
        return activity


class LeadActivityUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadActivity
        fields = ('status', 'completion_notes', 'assigned_to', 'due_date', 'priority', 'notes')

    def validate_assigned_to(self, value):
        user = self.context['request'].user
        if user.is_super_admin:
            return value
        if value.id != user.id:
            raise serializers.ValidationError('You can only assign activities to yourself.')
        return value

    def update(self, instance, validated_data):
        from django.utils import timezone

        user = self.context['request'].user
        tracked_fields = ('activity_type', 'notes', 'status', 'completion_notes')
        previous_values = {field: getattr(instance, field) for field in tracked_fields}
        changes = {}

        new_status = validated_data.get('status', instance.status)
        if new_status in {LeadActivity.Status.DONE, LeadActivity.Status.CLOSED}:
            if instance.status not in {LeadActivity.Status.DONE, LeadActivity.Status.CLOSED}:
                validated_data['completed_at'] = timezone.now()
        elif new_status in {LeadActivity.Status.OPEN, LeadActivity.Status.IN_PROGRESS}:
            if instance.status in {LeadActivity.Status.DONE, LeadActivity.Status.CLOSED}:
                validated_data['completed_at'] = None
                validated_data['completion_notes'] = ''

        activity = super().update(instance, validated_data)

        for field in tracked_fields:
            old_value = previous_values[field]
            new_value = getattr(activity, field)
            if old_value != new_value:
                changes[field] = {'from': old_value, 'to': new_value}

        if changes:
            history = list(activity.edit_history or [])
            history.append({
                'edited_at': timezone.now().isoformat(),
                'edited_by': user.id,
                'changes': changes,
            })
            activity.edit_history = history
            activity.edited_by = user
            activity.edited_at = timezone.now()
            activity.save(update_fields=['edit_history', 'edited_by', 'edited_at', 'updated_at'])
            from leads.risk_events import record_activity_edited_event

            record_activity_edited_event(user, activity.lead, activity, changes)

        return activity
