import hashlib
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    HR_OPERATIONS = "HR_OPERATIONS", "HR Operations"
    EMPLOYEE = "EMPLOYEE", "Employee"
    REPORTING_MANAGER = "REPORTING_MANAGER", "Reporting Manager"
    INTERVIEWER = "INTERVIEWER", "Interviewer"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        # Django admin access only; business authority comes from RoleAssignment.
        extra.update(is_staff=True, is_superuser=True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("common.Organization", null=True, on_delete=models.PROTECT, related_name="users")
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)  # soft-disable; never delete history
    is_staff = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    policy_accepted_at = models.DateTimeField(null=True, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    def __str__(self) -> str:
        return self.email

    @property
    def role_set(self) -> set[str]:
        if not hasattr(self, "_roles"):
            self._roles = set(self.role_assignments.values_list("role", flat=True))
        return self._roles

    def has_role(self, *roles: str) -> bool:
        return bool(self.role_set.intersection(roles))


class RoleAssignment(models.Model):
    """Roles are additive; HR and managers also hold EMPLOYEE. Only Super Admin can change them."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="role_assignments")
    role = models.CharField(max_length=30, choices=Role.choices)
    granted_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "role"], name="uniq_user_role")]


class Invite(models.Model):
    """Expiring single-use activation link. Only the SHA-256 of the token is stored."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="invites")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def hash(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @classmethod
    def issue(cls, user: User, created_by: User | None) -> tuple["Invite", str]:
        cls.objects.filter(user=user, used_at__isnull=True, revoked_at__isnull=True).update(revoked_at=timezone.now())
        token = secrets.token_urlsafe(32)
        invite = cls.objects.create(
            user=user,
            token_hash=cls.hash(token),
            expires_at=timezone.now() + timedelta(hours=settings.INVITE_TTL_HOURS),
            created_by=created_by,
        )
        return invite, token

    @property
    def is_usable(self) -> bool:
        return self.used_at is None and self.revoked_at is None and self.expires_at > timezone.now()
