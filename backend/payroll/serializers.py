from rest_framework import serializers

from employees.models import Employee
from payroll.models import EmployeePayrollDraft, EmployeePayrollProfile, PayrollRun, SalaryStructure

NON_NEGATIVE_FIELDS = (
    'annual_ctc',
    'monthly_gross_salary',
    'basic_salary',
    'hra',
    'conveyance_allowance',
    'special_allowance',
    'other_allowance',
    'employee_pf',
    'employee_esi',
    'professional_tax',
    'tds',
    'other_deduction',
)


class SalaryStructureSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True)

    class Meta:
        model = SalaryStructure
        fields = (
            'id',
            'employee',
            'employee_code',
            'employee_name',
            'effective_from',
            'annual_ctc',
            'pf_status',
            'monthly_gross_salary',
            'basic_salary',
            'hra',
            'conveyance_allowance',
            'special_allowance',
            'other_allowance',
            'employee_pf',
            'employee_esi',
            'professional_tax',
            'tds',
            'other_deduction',
            'is_active',
            'created_by',
            'created_by_name',
            'updated_by',
            'updated_by_name',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        )

    def validate(self, attrs):
        merged = {**getattr(self, 'initial_data', {}), **attrs}
        for field in NON_NEGATIVE_FIELDS:
            value = merged.get(field)
            if value is not None and value != '' and float(value) < 0:
                raise serializers.ValidationError({field: 'Amount cannot be negative.'})
        return attrs


class SalaryStructureWriteSerializer(SalaryStructureSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())

    class Meta(SalaryStructureSerializer.Meta):
        read_only_fields = SalaryStructureSerializer.Meta.read_only_fields

    def validate_employee(self, value):
        if not value:
            raise serializers.ValidationError('Employee is required.')
        return value

    def validate_effective_from(self, value):
        if not value:
            raise serializers.ValidationError('Effective from date is required.')
        return value

    def validate_monthly_gross_salary(self, value):
        if value is None:
            raise serializers.ValidationError('Monthly gross salary is required.')
        if value < 0:
            raise serializers.ValidationError('Amount cannot be negative.')
        return value


class SalaryStructureCalculateSerializer(serializers.Serializer):
    annual_ctc = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0)
    monthly_gross_salary = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    pf_status = serializers.ChoiceField(
        choices=SalaryStructure.PfStatus.choices,
        default=SalaryStructure.PfStatus.NOT_APPLICABLE,
    )
    conveyance_allowance = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
        default=0,
    )
    other_allowance = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
        default=0,
    )

    def validate(self, attrs):
        if attrs.get('annual_ctc') is None and attrs.get('monthly_gross_salary') is None:
            raise serializers.ValidationError('Provide annual CTC or monthly gross salary.')
        return attrs


class EmployeePayrollDraftSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)

    class Meta:
        model = EmployeePayrollDraft
        fields = (
            'id',
            'payroll_run',
            'employee',
            'employee_code',
            'employee_name',
            'salary_structure',
            'status',
            'monthly_gross_salary',
            'total_working_days',
            'present_days',
            'paid_leave_days',
            'lop_days',
            'absent_days',
            'half_days',
            'gross_pay',
            'lop_deduction',
            'bonus_amount',
            'incentive_amount',
            'reimbursement_amount',
            'other_deductions',
            'hold_salary',
            'net_pay',
            'remarks',
            'adjustment_remarks',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_at',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class EmployeePayrollDraftUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeePayrollDraft
        fields = (
            'bonus_amount',
            'incentive_amount',
            'reimbursement_amount',
            'other_deductions',
            'hold_salary',
            'adjustment_remarks',
        )

    def validate(self, attrs):
        instance = self.instance
        bonus_amount = attrs.get('bonus_amount', instance.bonus_amount)
        incentive_amount = attrs.get('incentive_amount', instance.incentive_amount)
        reimbursement_amount = attrs.get('reimbursement_amount', instance.reimbursement_amount)
        other_deductions = attrs.get('other_deductions', instance.other_deductions)
        hold_salary = attrs.get('hold_salary', instance.hold_salary)
        adjustment_remarks = attrs.get('adjustment_remarks', instance.adjustment_remarks)

        for field_name, value in (
            ('bonus_amount', bonus_amount),
            ('incentive_amount', incentive_amount),
            ('reimbursement_amount', reimbursement_amount),
            ('other_deductions', other_deductions),
        ):
            if value is not None and value < 0:
                raise serializers.ValidationError({field_name: 'Amount cannot be negative.'})

        if hold_salary or other_deductions > 0:
            if not str(adjustment_remarks or '').strip():
                raise serializers.ValidationError(
                    {'adjustment_remarks': 'Adjustment remarks are required when salary is on hold or other deductions apply.'}
                )

        return attrs

    def validate_bonus_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Amount cannot be negative.')
        return value

    def validate_incentive_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Amount cannot be negative.')
        return value

    def validate_reimbursement_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Amount cannot be negative.')
        return value

    def validate_other_deductions(self, value):
        if value < 0:
            raise serializers.ValidationError('Amount cannot be negative.')
        return value


class PayrollRunSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)
    employee_drafts = EmployeePayrollDraftSerializer(many=True, read_only=True)

    class Meta:
        model = PayrollRun
        fields = (
            'id',
            'month',
            'year',
            'start_date',
            'end_date',
            'status',
            'total_employees',
            'generated_by',
            'generated_by_name',
            'generated_at',
            'created_at',
            'updated_at',
            'employee_drafts',
        )
        read_only_fields = fields


class PayrollRunListSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)

    class Meta:
        model = PayrollRun
        fields = (
            'id',
            'month',
            'year',
            'start_date',
            'end_date',
            'status',
            'total_employees',
            'generated_by',
            'generated_by_name',
            'generated_at',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class PayrollRunCreateSerializer(serializers.Serializer):
    month = serializers.IntegerField(min_value=1, max_value=12)
    year = serializers.IntegerField(min_value=2000, max_value=2100)


class EmployeePayrollProfileSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True)

    class Meta:
        model = EmployeePayrollProfile
        fields = (
            'id',
            'employee',
            'employee_code',
            'employee_name',
            'pan_number',
            'aadhaar_last_four',
            'bank_name',
            'bank_account_number',
            'ifsc_code',
            'account_holder_name',
            'uan_number',
            'pf_number',
            'esi_number',
            'tax_regime',
            'is_active',
            'created_by',
            'created_by_name',
            'updated_by',
            'updated_by_name',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        )


class EmployeePayrollProfileListSerializer(EmployeePayrollProfileSerializer):
    masked_account_number = serializers.SerializerMethodField()

    class Meta(EmployeePayrollProfileSerializer.Meta):
        fields = EmployeePayrollProfileSerializer.Meta.fields + ('masked_account_number',)

    def get_masked_account_number(self, obj):
        from payroll.validators import mask_bank_account_number

        return mask_bank_account_number(obj.bank_account_number)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop('bank_account_number', None)
        return data


class EmployeePayrollProfileWriteSerializer(EmployeePayrollProfileSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())

    class Meta(EmployeePayrollProfileSerializer.Meta):
        read_only_fields = EmployeePayrollProfileSerializer.Meta.read_only_fields

    def validate_employee(self, value):
        if not value:
            raise serializers.ValidationError('Employee is required.')
        if self.instance is None and EmployeePayrollProfile.objects.filter(employee=value).exists():
            raise serializers.ValidationError('A payroll profile already exists for this employee.')
        return value

    def validate_pan_number(self, value):
        from payroll.validators import validate_pan

        try:
            return validate_pan(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_aadhaar_last_four(self, value):
        from payroll.validators import validate_aadhaar_last_four

        try:
            return validate_aadhaar_last_four(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_ifsc_code(self, value):
        from payroll.validators import validate_ifsc

        try:
            return validate_ifsc(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_bank_account_number(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Bank account number is required.')
        return cleaned

    def validate_account_holder_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Account holder name is required.')
        return cleaned
