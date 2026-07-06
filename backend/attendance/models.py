from decimal import Decimal

from django.db import models
from django.utils import timezone

from employees.models import Employee


class Attendance(models.Model):
    class WorkMode(models.TextChoices):
        OFFICE = 'OFFICE', 'Office'
        WORK_FROM_HOME = 'WORK_FROM_HOME', 'Work From Home'
        CLIENT_LOCATION = 'CLIENT_LOCATION', 'Client Location'

    class Status(models.TextChoices):
        PRESENT = 'PRESENT', 'Present'
        ABSENT = 'ABSENT', 'Absent'
        HALF_DAY = 'HALF_DAY', 'Half Day'
        LATE = 'LATE', 'Late'
        ON_LEAVE = 'ON_LEAVE', 'On Leave'
        HOLIDAY = 'HOLIDAY', 'Holiday'
        MISSING_CHECKOUT = 'MISSING_CHECKOUT', 'Missing Checkout'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    date = models.DateField()
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    work_mode = models.CharField(
        max_length=20,
        choices=WorkMode.choices,
        default=WorkMode.OFFICE,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ABSENT,
    )
    total_work_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    late_minutes = models.PositiveIntegerField(default=0)
    remarks = models.TextField(blank=True)
    daily_report_summary = models.JSONField(null=True, blank=True)
    tomorrow_plan = models.TextField(blank=True)
    kpi_snapshot = models.JSONField(null=True, blank=True)
    kpi_miss_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-date', '-created_at')
        constraints = [
            models.UniqueConstraint(
                fields=('employee', 'date'),
                name='unique_attendance_per_employee_per_day',
            ),
        ]

    def __str__(self):
        return f'{self.employee.employee_code} - {self.date}'

    @property
    def employee_code(self):
        return self.employee.employee_code

    @property
    def employee_name(self):
        return self.employee.full_name

    @property
    def department(self):
        return self.employee.department


class AttendanceRegularization(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='attendance_regularizations',
    )
    date = models.DateField()
    requested_check_in = models.TimeField(null=True, blank=True)
    requested_check_out = models.TimeField(null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    is_backdated = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_regularizations',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rejected_regularizations',
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.employee.employee_code} - {self.date}'

    @property
    def employee_code(self):
        return self.employee.employee_code

    @property
    def employee_name(self):
        return self.employee.full_name
