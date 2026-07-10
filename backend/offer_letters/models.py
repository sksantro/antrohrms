import re
import uuid

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from employees.models import Employee


class OfferLetter(models.Model):
    CODE_PREFIX = 'OFF-'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SENT = 'SENT', 'Sent'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REJECTED = 'REJECTED', 'Rejected'
        EXPIRED = 'EXPIRED', 'Expired'
        CANCELLED = 'CANCELLED', 'Cancelled'

    offer_id = models.CharField(max_length=20, unique=True, editable=False)
    candidate_name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, choices=Employee.Department.choices)
    designation = models.CharField(max_length=100)
    reporting_manager = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='offer_letters_as_manager',
    )
    reporting_manager_name = models.CharField(max_length=200, blank=True)
    work_location = models.CharField(max_length=150, blank=True)
    joining_date = models.DateField()
    employment_type = models.CharField(
        max_length=20,
        choices=Employee.EmploymentType.choices,
        default=Employee.EmploymentType.FULL_TIME,
    )
    offered_ctc = models.TextField(help_text='Compensation summary for the offer document only.')
    offer_valid_till = models.DateField()
    terms_and_conditions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    acceptance_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    accepted_document_snapshot = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_offer_letters',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.offer_id} - {self.candidate_name}'

    @classmethod
    def generate_offer_id(cls):
        codes = cls.objects.values_list('offer_id', flat=True)
        max_num = 0
        for code in codes:
            if not code:
                continue
            match = re.match(rf'^{re.escape(cls.CODE_PREFIX)}(\d+)$', code)
            if match:
                max_num = max(max_num, int(match.group(1)))
        return f'{cls.CODE_PREFIX}{max_num + 1:04d}'

    def refresh_expiry_status(self):
        if (
            self.status == self.Status.SENT
            and self.offer_valid_till
            and self.offer_valid_till < timezone.localdate()
        ):
            self.status = self.Status.EXPIRED
            return True
        return False

    def save(self, *args, **kwargs):
        if self.offer_id and self.offer_id.strip():
            self.offer_id = self.offer_id.strip()
            return super().save(*args, **kwargs)

        if not self._state.adding:
            self.offer_id = self.generate_offer_id()
            return super().save(*args, **kwargs)

        for _ in range(5):
            self.offer_id = self.generate_offer_id()
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError as exc:
                if 'offer_id' not in str(exc):
                    raise
        raise IntegrityError('Unable to generate a unique offer ID after multiple attempts.')
