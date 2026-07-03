from django.conf import settings
from django.db import models


def policy_upload_path(instance, filename):
    return f'policies/{instance.id or "new"}/{filename}'


class Policy(models.Model):
    class Category(models.TextChoices):
        LEAVE_POLICY = 'LEAVE_POLICY', 'Leave Policy'
        ATTENDANCE_POLICY = 'ATTENDANCE_POLICY', 'Attendance Policy'
        WFH_POLICY = 'WFH_POLICY', 'Work From Home Policy'
        CODE_OF_CONDUCT = 'CODE_OF_CONDUCT', 'Code of Conduct'
        DATA_SECURITY = 'DATA_SECURITY', 'Data Security Policy'
        ASSET_USAGE = 'ASSET_USAGE', 'Asset Usage Policy'
        PAYROLL_POLICY = 'PAYROLL_POLICY', 'Salary/Payroll Policy'
        EXIT_POLICY = 'EXIT_POLICY', 'Exit Policy'
        PROBATION_POLICY = 'PROBATION_POLICY', 'Probation Policy'
        ANTI_HARASSMENT = 'ANTI_HARASSMENT', 'Anti-Harassment Policy'
        OTHER = 'OTHER', 'Other'

    title = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=Category.choices)
    version = models.CharField(max_length=20)
    description = models.TextField(blank=True)
    policy_file = models.FileField(upload_to='policies/')
    effective_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_policies',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-effective_date', '-created_at')
        verbose_name_plural = 'policies'

    def __str__(self):
        return f'{self.title} v{self.version}'

    @property
    def created_by_name(self):
        if not self.created_by:
            return ''
        return self.created_by.full_name or self.created_by.email


class PolicyAcknowledgement(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACKNOWLEDGED = 'ACKNOWLEDGED', 'Acknowledged'

    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='acknowledgements',
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='policy_acknowledgements',
    )
    policy_version = models.CharField(max_length=20)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=('policy', 'employee', 'policy_version'),
                name='unique_policy_ack_per_employee_version',
            ),
        ]

    def __str__(self):
        return f'{self.employee.employee_code} - {self.policy.title} v{self.policy_version}'

    @property
    def employee_code(self):
        return self.employee.employee_code

    @property
    def employee_name(self):
        return self.employee.full_name

    @property
    def policy_title(self):
        return self.policy.title
