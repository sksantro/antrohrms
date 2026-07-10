from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from accounts.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """Email-based user model with role-based access."""

    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
        HR_ADMIN = 'HR_ADMIN', 'HR Admin'
        MANAGER = 'MANAGER', 'Manager'
        EMPLOYEE = 'EMPLOYEE', 'Employee'
        FINANCE = 'FINANCE', 'Finance'

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'
        ordering = ('email',)

    def __str__(self):
        return self.email

    @property
    def is_super_admin(self):
        return self.role == self.Role.SUPER_ADMIN or self.is_superuser

    @property
    def is_hr_admin(self):
        from employees.hr_access import user_has_hr_access

        return user_has_hr_access(self)

    @property
    def is_manager(self):
        return self.role == self.Role.MANAGER

    @property
    def is_finance(self):
        return self.role == self.Role.FINANCE

    @property
    def is_employee_user(self):
        return self.role == self.Role.EMPLOYEE


class Notification(models.Model):
    class Type(models.TextChoices):
        LEAVE_APPLIED = 'LEAVE_APPLIED', 'Leave Applied'
        LEAVE_APPROVED = 'LEAVE_APPROVED', 'Leave Approved'
        LEAVE_REJECTED = 'LEAVE_REJECTED', 'Leave Rejected'
        LEAVE_ESCALATED = 'LEAVE_ESCALATED', 'Leave Escalated'
        LEAVE_CANCELLATION = 'LEAVE_CANCELLATION', 'Leave Cancellation'
        REGULARIZATION_APPLIED = 'REGULARIZATION_APPLIED', 'Regularization Applied'
        REGULARIZATION_APPROVED = 'REGULARIZATION_APPROVED', 'Regularization Approved'
        REGULARIZATION_REJECTED = 'REGULARIZATION_REJECTED', 'Regularization Rejected'

    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=40, choices=Type.choices)
    is_read = models.BooleanField(default=False)
    related_id = models.PositiveIntegerField(null=True, blank=True)
    related_model = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user.email} - {self.title}'
