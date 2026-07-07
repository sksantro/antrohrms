import re
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, models, transaction


class Employee(models.Model):
    CODE_PREFIX = 'ANT-EMP-'

    class Gender(models.TextChoices):
        MALE = 'MALE', 'Male'
        FEMALE = 'FEMALE', 'Female'
        OTHER = 'OTHER', 'Other'

    class EmploymentType(models.TextChoices):
        FULL_TIME = 'FULL_TIME', 'Full Time'
        INTERN = 'INTERN', 'Intern'
        CONTRACT = 'CONTRACT', 'Contract'
        CONSULTANT = 'CONSULTANT', 'Consultant'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INACTIVE = 'INACTIVE', 'Inactive'
        RESIGNED = 'RESIGNED', 'Resigned'
        TERMINATED = 'TERMINATED', 'Terminated'

    class Department(models.TextChoices):
        SALES_MARKETING = 'Sales & Marketing', 'Sales & Marketing'
        HR = 'HR', 'HR'
        TECHNOLOGY = 'Technology', 'Technology'
        OPERATIONS = 'Operations', 'Operations'
        MANAGEMENT = 'Management', 'Management'
        FINANCE = 'Finance', 'Finance'
        ADMIN = 'Admin', 'Admin'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employee_profile',
    )
    employee_code = models.CharField(max_length=20, unique=True, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    alternate_phone = models.CharField(max_length=20, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    joining_date = models.DateField()
    department = models.CharField(max_length=100, choices=Department.choices)
    designation = models.CharField(max_length=100)
    reporting_manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports',
    )
    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.FULL_TIME,
    )
    internship_end_date = models.DateField(null=True, blank=True)
    original_internship_end_date = models.DateField(null=True, blank=True)
    internship_extended_days = models.PositiveIntegerField(default=0)
    work_location = models.CharField(max_length=150, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    address = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('employee_code',)

    def __str__(self):
        return f'{self.employee_code} - {self.full_name}'

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def is_intern(self):
        return self.employment_type == self.EmploymentType.INTERN

    @property
    def revised_internship_end_date(self):
        if not self.original_internship_end_date:
            return self.internship_end_date
        return self.original_internship_end_date + timedelta(days=self.internship_extended_days)

    @classmethod
    def generate_employee_code(cls):
        codes = cls.objects.values_list('employee_code', flat=True)
        max_num = 0
        for code in codes:
            if not code:
                continue
            match = re.match(rf'^{re.escape(cls.CODE_PREFIX)}(\d+)$', code)
            if match:
                max_num = max(max_num, int(match.group(1)))
        return f'{cls.CODE_PREFIX}{max_num + 1:04d}'

    def save(self, *args, **kwargs):
        if self.employee_code and self.employee_code.strip():
            self.employee_code = self.employee_code.strip()
            return super().save(*args, **kwargs)

        if not self._state.adding:
            self.employee_code = self.generate_employee_code()
            return super().save(*args, **kwargs)

        # Retry code generation on rare concurrent inserts.
        for _ in range(5):
            self.employee_code = self.generate_employee_code()
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError as exc:
                if 'employee_code' not in str(exc):
                    raise
        raise IntegrityError('Unable to generate a unique employee code after multiple attempts.')
