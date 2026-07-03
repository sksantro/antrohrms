from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class SalaryStructure(models.Model):
    class PfStatus(models.TextChoices):
        NOT_APPLICABLE = 'NOT_APPLICABLE', 'Not Applicable — excluded employee'
        APPLICABLE_EXISTING_UAN = 'APPLICABLE_EXISTING_UAN', 'Applicable — employee already has PF/UAN'
        APPLICABLE_COMPANY_POLICY = 'APPLICABLE_COMPANY_POLICY', 'Applicable — company policy'
        APPLICABLE_STATUTORY = 'APPLICABLE_STATUTORY', 'Applicable — statutory requirement'
        VOLUNTARY_PF = 'VOLUNTARY_PF', 'Voluntary PF'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.PROTECT,
        related_name='salary_structures',
    )
    effective_from = models.DateField()
    annual_ctc = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    pf_status = models.CharField(
        max_length=40,
        choices=PfStatus.choices,
        default=PfStatus.NOT_APPLICABLE,
    )
    monthly_gross_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    basic_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    hra = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    conveyance_allowance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    special_allowance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    other_allowance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    employee_pf = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    employee_esi = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    professional_tax = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    tds = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    other_deduction = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salary_structures_created',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salary_structures_updated',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-effective_from', '-created_at']
        indexes = [
            models.Index(fields=['employee', 'is_active']),
        ]

    def __str__(self):
        return f'{self.employee.employee_code} — {self.effective_from}'


class PayrollRun(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        LOCKED = 'LOCKED', 'Locked'
        CANCELLED = 'CANCELLED', 'Cancelled'

    month = models.PositiveSmallIntegerField()
    year = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    total_employees = models.PositiveIntegerField(default=0)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_runs_generated',
    )
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-month', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=('month', 'year'),
                condition=models.Q(status__in=['DRAFT', 'LOCKED']),
                name='unique_active_payroll_run_per_month',
            ),
        ]

    def __str__(self):
        return f'Payroll {self.month}/{self.year} ({self.status})'


class EmployeePayrollDraft(models.Model):
    class Status(models.TextChoices):
        MISSING_SALARY_STRUCTURE = 'MISSING_SALARY_STRUCTURE', 'Missing Salary Structure'
        MISSING_PAYROLL_PROFILE = 'MISSING_PAYROLL_PROFILE', 'Missing Payroll Profile'
        READY = 'READY', 'Ready'

    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name='employee_drafts',
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.PROTECT,
        related_name='payroll_drafts',
    )
    salary_structure = models.ForeignKey(
        SalaryStructure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_drafts',
    )
    monthly_gross_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    total_working_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    present_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    paid_leave_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    lop_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    absent_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    half_days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    gross_pay = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    lop_deduction = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    other_deductions = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    bonus_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    incentive_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    reimbursement_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    hold_salary = models.BooleanField(default=False)
    adjustment_remarks = models.TextField(blank=True)
    status = models.CharField(
        max_length=40,
        choices=Status.choices,
        default=Status.READY,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_drafts_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    net_pay = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee__employee_code']
        constraints = [
            models.UniqueConstraint(
                fields=('payroll_run', 'employee'),
                name='unique_employee_payroll_draft_per_run',
            ),
        ]

    def __str__(self):
        return f'{self.payroll_run_id} — {self.employee.employee_code}'


class EmployeePayrollProfile(models.Model):
    class TaxRegime(models.TextChoices):
        OLD = 'OLD', 'Old Regime'
        NEW = 'NEW', 'New Regime'
        NOT_DECLARED = 'NOT_DECLARED', 'Not Declared'

    employee = models.OneToOneField(
        'employees.Employee',
        on_delete=models.PROTECT,
        related_name='payroll_profile',
    )
    pan_number = models.CharField(max_length=10)
    aadhaar_last_four = models.CharField(max_length=4)
    bank_name = models.CharField(max_length=120)
    bank_account_number = models.CharField(max_length=30)
    ifsc_code = models.CharField(max_length=11)
    account_holder_name = models.CharField(max_length=120)
    uan_number = models.CharField(max_length=20, blank=True)
    pf_number = models.CharField(max_length=30, blank=True)
    esi_number = models.CharField(max_length=30, blank=True)
    tax_regime = models.CharField(
        max_length=20,
        choices=TaxRegime.choices,
        default=TaxRegime.NOT_DECLARED,
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_profiles_created',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_profiles_updated',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee__employee_code']

    def __str__(self):
        return f'{self.employee.employee_code} payroll profile'
