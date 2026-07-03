from decimal import Decimal

from django.conf import settings
from django.db import models

from employees.models import Employee


class LeaveBalance(models.Model):
    """Single paid-leave wallet per employee per calendar year."""

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_balances',
    )
    year = models.PositiveIntegerField()
    paid_leave_balance = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    paid_leave_earned = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    paid_leave_used = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    lop_days = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-year', 'employee__employee_code')
        constraints = [
            models.UniqueConstraint(
                fields=('employee', 'year'),
                name='unique_leave_balance_per_employee_year',
            ),
        ]

    def __str__(self):
        return f'{self.employee.employee_code} - {self.year}'


class LeaveRequest(models.Model):
    class LeaveType(models.TextChoices):
        CASUAL = 'CASUAL', 'Casual'
        SICK = 'SICK', 'Sick'
        EMERGENCY = 'EMERGENCY', 'Emergency'
        PLANNED = 'PLANNED', 'Planned'
        UNPAID = 'UNPAID', 'Unpaid'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'
        CANCELLATION_REQUESTED = 'CANCELLATION_REQUESTED', 'Cancellation Requested'

    class HalfDaySession(models.TextChoices):
        FIRST_HALF = 'FIRST_HALF', 'First Half'
        SECOND_HALF = 'SECOND_HALF', 'Second Half'

    class ApprovalLevel(models.TextChoices):
        MANAGER = 'MANAGER', 'Manager'
        HR = 'HR', 'HR Admin'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_requests',
    )
    leave_type = models.CharField(max_length=20, choices=LeaveType.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    total_working_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))
    half_day = models.BooleanField(default=False)
    half_day_session = models.CharField(
        max_length=20,
        choices=HalfDaySession.choices,
        blank=True,
    )
    reason = models.TextField()
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    approval_level = models.CharField(
        max_length=20,
        choices=ApprovalLevel.choices,
        default=ApprovalLevel.MANAGER,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leave_requests',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rejected_leave_requests',
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    escalated_to_hr = models.BooleanField(default=False)
    escalated_at = models.DateTimeField(null=True, blank=True)
    is_backdated = models.BooleanField(default=False)
    is_special_approval_required = models.BooleanField(default=False)
    lop_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    paid_leave_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.employee.employee_code} - {self.leave_type} ({self.start_date})'

    @property
    def employee_code(self):
        return self.employee.employee_code

    @property
    def employee_name(self):
        return self.employee.full_name

    @property
    def approved_by_name(self):
        if not self.approved_by:
            return ''
        return self.approved_by.full_name or self.approved_by.email

    @property
    def rejected_by_name(self):
        if not self.rejected_by:
            return ''
        return self.rejected_by.full_name or self.rejected_by.email

    @property
    def is_paid_leave_type(self):
        return self.leave_type != self.LeaveType.UNPAID
