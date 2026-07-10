import re
import uuid

from django.conf import settings
from django.db import IntegrityError, models, transaction

from employees.models import Employee


class OnboardingRecord(models.Model):
    CODE_PREFIX = 'ONB-'

    class Status(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', 'Not Started'
        INVITED = 'INVITED', 'Invited'
        PROFILE_PENDING = 'PROFILE_PENDING', 'Profile Pending'
        DOCUMENTS_PENDING = 'DOCUMENTS_PENDING', 'Documents Pending'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        COMPLETED = 'COMPLETED', 'Completed'
        CORRECTION_REQUIRED = 'CORRECTION_REQUIRED', 'Rejected / Correction Required'

    onboarding_id = models.CharField(max_length=20, unique=True, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='onboarding_records',
    )
    offer_letter = models.OneToOneField(
        'offer_letters.OfferLetter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='onboarding_record',
    )
    candidate_name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, choices=Employee.Department.choices)
    designation = models.CharField(max_length=100)
    joining_date = models.DateField()
    employment_type = models.CharField(
        max_length=20,
        choices=Employee.EmploymentType.choices,
        default=Employee.EmploymentType.FULL_TIME,
    )
    work_location = models.CharField(max_length=150, blank=True)
    reporting_manager = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='onboarding_reports',
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.NOT_STARTED,
    )
    invite_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    invited_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    correction_reason = models.TextField(blank=True)
    profile_data = models.JSONField(default=dict, blank=True)
    education_details = models.JSONField(default=list, blank=True)
    employment_history = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_onboarding_records',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_onboarding_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)

    def __str__(self):
        return f'{self.onboarding_id} - {self.candidate_name}'

    @classmethod
    def generate_onboarding_id(cls):
        codes = cls.objects.values_list('onboarding_id', flat=True)
        max_num = 0
        for code in codes:
            if not code:
                continue
            match = re.match(rf'^{re.escape(cls.CODE_PREFIX)}(\d+)$', code)
            if match:
                max_num = max(max_num, int(match.group(1)))
        return f'{cls.CODE_PREFIX}{max_num + 1:04d}'

    def save(self, *args, **kwargs):
        if self.onboarding_id and self.onboarding_id.strip():
            return super().save(*args, **kwargs)

        if not self._state.adding:
            self.onboarding_id = self.generate_onboarding_id()
            return super().save(*args, **kwargs)

        for _ in range(5):
            self.onboarding_id = self.generate_onboarding_id()
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError as exc:
                if 'onboarding_id' not in str(exc):
                    raise
        raise IntegrityError('Unable to generate a unique onboarding id.')


class OnboardingDocument(models.Model):
    class DocumentType(models.TextChoices):
        AADHAAR = 'AADHAAR', 'Aadhaar'
        PAN = 'PAN', 'PAN'
        RESUME = 'RESUME', 'Resume'
        PHOTO = 'PHOTO', 'Photo'
        EDUCATION_CERTIFICATE = 'EDUCATION_CERTIFICATE', 'Education Certificate'
        EXPERIENCE_RELIVING = 'EXPERIENCE_RELIVING', 'Experience / Relieving Letter'

    onboarding = models.ForeignKey(
        OnboardingRecord,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    document_type = models.CharField(max_length=40, choices=DocumentType.choices)
    file = models.FileField(upload_to='onboarding/documents/')
    original_filename = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('document_type', '-uploaded_at')
        unique_together = ('onboarding', 'document_type')

    def __str__(self):
        return f'{self.onboarding.onboarding_id} - {self.document_type}'
