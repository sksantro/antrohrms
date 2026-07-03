from rest_framework import serializers

from settings_app.models import CompanyHoliday, CompanySettings

WEEKDAY_LABELS = [
    ('Monday', 0),
    ('Tuesday', 1),
    ('Wednesday', 2),
    ('Thursday', 3),
    ('Friday', 4),
    ('Saturday', 5),
    ('Sunday', 6),
]

MONTH_LABELS = [
    (1, 'January'),
    (2, 'February'),
    (3, 'March'),
    (4, 'April'),
    (5, 'May'),
    (6, 'June'),
    (7, 'July'),
    (8, 'August'),
    (9, 'September'),
    (10, 'October'),
    (11, 'November'),
    (12, 'December'),
]


class CompanySettingsSerializer(serializers.ModelSerializer):
    weekly_off_day_labels = serializers.SerializerMethodField(read_only=True)
    financial_year_start_month_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CompanySettings
        fields = (
            'id',
            'company_name',
            'office_start_time',
            'office_end_time',
            'full_day_minimum_hours',
            'half_day_minimum_hours',
            'weekly_off_days',
            'weekly_off_day_labels',
            'financial_year_start_month',
            'financial_year_start_month_label',
            'leave_joining_cutoff_day',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_weekly_off_day_labels(self, obj):
        labels = dict(WEEKDAY_LABELS)
        return [labels.get(day, str(day)) for day in obj.get_weekly_off_days()]

    def get_financial_year_start_month_label(self, obj):
        month_map = dict(MONTH_LABELS)
        return month_map.get(obj.financial_year_start_month, '')

    def validate_weekly_off_days(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Weekly off days must be a list.')
        for day in value:
            if not isinstance(day, int) or day < 0 or day > 6:
                raise serializers.ValidationError(
                    'Each weekly off day must be an integer from 0 (Monday) to 6 (Sunday).',
                )
        return sorted(set(value))

    def validate_financial_year_start_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError('Financial year start month must be between 1 and 12.')
        return value

    def validate_leave_joining_cutoff_day(self, value):
        if value < 1 or value > 31:
            raise serializers.ValidationError('Leave joining cutoff day must be between 1 and 31.')
        return value

    def validate(self, attrs):
        start = attrs.get('office_start_time')
        end = attrs.get('office_end_time')
        if self.instance:
            start = start if start is not None else self.instance.office_start_time
            end = end if end is not None else self.instance.office_end_time
        if start and end and end <= start:
            raise serializers.ValidationError({'office_end_time': 'Office end time must be after start time.'})

        full_day = attrs.get('full_day_minimum_hours')
        half_day = attrs.get('half_day_minimum_hours')
        if self.instance:
            full_day = full_day if full_day is not None else self.instance.full_day_minimum_hours
            half_day = half_day if half_day is not None else self.instance.half_day_minimum_hours
        if full_day is not None and half_day is not None and half_day >= full_day:
            raise serializers.ValidationError(
                {'half_day_minimum_hours': 'Half day minimum must be less than full day minimum.'},
            )
        return attrs


class CompanyHolidaySerializer(serializers.ModelSerializer):
    is_optional = serializers.SerializerMethodField()

    class Meta:
        model = CompanyHoliday
        fields = (
            'id',
            'name',
            'date',
            'holiday_type',
            'base_holiday_type',
            'is_optional',
            'description',
            'is_active',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_optional')

    def get_is_optional(self, obj):
        return obj.holiday_type == CompanyHoliday.HolidayType.OPTIONAL_HOLIDAY
