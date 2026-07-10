from django.utils import timezone

from accounts.models import User
from accounts.utils import generate_temporary_password
from employees.models import Employee
from offer_letters.models import OfferLetter

from onboarding.models import OnboardingDocument, OnboardingRecord

REQUIRED_DOCUMENT_TYPES = {
    OnboardingDocument.DocumentType.AADHAAR,
    OnboardingDocument.DocumentType.PAN,
    OnboardingDocument.DocumentType.RESUME,
    OnboardingDocument.DocumentType.PHOTO,
    OnboardingDocument.DocumentType.EDUCATION_CERTIFICATE,
}


def split_candidate_name(name: str) -> tuple[str, str]:
    parts = (name or '').strip().split(None, 1)
    if not parts:
        return 'Candidate', ''
    if len(parts) == 1:
        return parts[0], ''
    return parts[0], parts[1]


def compute_documents_status(record: OnboardingRecord) -> str:
    uploaded = set(record.documents.values_list('document_type', flat=True))
    required_uploaded = uploaded.intersection(REQUIRED_DOCUMENT_TYPES)
    if len(required_uploaded) == len(REQUIRED_DOCUMENT_TYPES):
        return 'Complete'
    if uploaded:
        return 'Partial'
    return 'Pending'


def _ensure_employee_inactive(employee: Employee | None) -> None:
    if employee and employee.status != Employee.Status.INACTIVE:
        employee.status = Employee.Status.INACTIVE
        employee.user.is_active = False
        employee.user.save(update_fields=['is_active', 'updated_at'])
        employee.save(update_fields=['status', 'updated_at'])


def create_onboarding_from_offer(offer: OfferLetter, created_by=None) -> OnboardingRecord:
    if hasattr(offer, 'onboarding_record') and offer.onboarding_record:
        return offer.onboarding_record

    if OnboardingRecord.objects.filter(email__iexact=offer.email).exclude(
        status=OnboardingRecord.Status.COMPLETED,
    ).exists():
        raise ValueError('An active onboarding record already exists for this email.')

    record = OnboardingRecord.objects.create(
        offer_letter=offer,
        candidate_name=offer.candidate_name,
        email=offer.email.lower().strip(),
        phone=offer.phone or '',
        department=offer.department,
        designation=offer.designation,
        joining_date=offer.joining_date,
        employment_type=offer.employment_type,
        work_location=offer.work_location or '',
        reporting_manager=offer.reporting_manager,
        status=OnboardingRecord.Status.NOT_STARTED,
        created_by=created_by,
    )
    return record


def ensure_onboarding_for_accepted_offer(offer: OfferLetter) -> OnboardingRecord | None:
    if offer.status != OfferLetter.Status.ACCEPTED:
        return None
    try:
        return create_onboarding_from_offer(offer, created_by=offer.created_by)
    except ValueError:
        return None


def link_employee_to_onboarding(record: OnboardingRecord, employee: Employee) -> OnboardingRecord:
    record.employee = employee
    record.save(update_fields=['employee', 'updated_at'])
    if record.status != OnboardingRecord.Status.COMPLETED:
        _ensure_employee_inactive(employee)
    return record


def send_onboarding_invite(record: OnboardingRecord) -> OnboardingRecord:
    if record.status == OnboardingRecord.Status.COMPLETED:
        raise ValueError('Completed onboarding cannot be invited again.')

    record.status = OnboardingRecord.Status.INVITED
    record.invited_at = timezone.now()
    record.correction_reason = ''
    record.save(update_fields=['status', 'invited_at', 'correction_reason', 'updated_at'])
    return record


def resend_onboarding_invite(record: OnboardingRecord) -> OnboardingRecord:
    if record.status == OnboardingRecord.Status.COMPLETED:
        raise ValueError('Completed onboarding cannot be re-invited.')
    return send_onboarding_invite(record)


def _profile_is_complete(profile_data: dict) -> bool:
    required = [
        'first_name',
        'last_name',
        'phone',
        'gender',
        'date_of_birth',
        'address',
        'emergency_contact_name',
        'emergency_contact_phone',
    ]
    return all(str(profile_data.get(field, '')).strip() for field in required)


def save_public_profile(
    record: OnboardingRecord,
    profile_data: dict,
    education_details: list | None = None,
    employment_history: list | None = None,
) -> OnboardingRecord:
    if record.status not in {
        OnboardingRecord.Status.INVITED,
        OnboardingRecord.Status.PROFILE_PENDING,
        OnboardingRecord.Status.DOCUMENTS_PENDING,
        OnboardingRecord.Status.CORRECTION_REQUIRED,
    }:
        raise ValueError('This onboarding record cannot be updated in its current status.')

    record.profile_data = profile_data or {}
    if education_details is not None:
        record.education_details = education_details
    if employment_history is not None:
        record.employment_history = employment_history

    if _profile_is_complete(record.profile_data):
        docs_status = compute_documents_status(record)
        if docs_status == 'Complete':
            record.status = OnboardingRecord.Status.SUBMITTED
            record.submitted_at = timezone.now()
        else:
            record.status = OnboardingRecord.Status.DOCUMENTS_PENDING
    else:
        record.status = OnboardingRecord.Status.PROFILE_PENDING

    record.save(
        update_fields=[
            'profile_data',
            'education_details',
            'employment_history',
            'status',
            'submitted_at',
            'updated_at',
        ],
    )
    return record


def upload_onboarding_document(
    record: OnboardingRecord,
    document_type: str,
    uploaded_file,
) -> OnboardingDocument:
    if record.status not in {
        OnboardingRecord.Status.INVITED,
        OnboardingRecord.Status.PROFILE_PENDING,
        OnboardingRecord.Status.DOCUMENTS_PENDING,
        OnboardingRecord.Status.CORRECTION_REQUIRED,
    }:
        raise ValueError('Documents cannot be uploaded in the current onboarding status.')

    valid_types = {choice.value for choice in OnboardingDocument.DocumentType}
    if document_type not in valid_types:
        raise ValueError('Invalid document type.')

    document, _created = OnboardingDocument.objects.update_or_create(
        onboarding=record,
        document_type=document_type,
        defaults={
            'file': uploaded_file,
            'original_filename': getattr(uploaded_file, 'name', ''),
        },
    )

    if _profile_is_complete(record.profile_data):
        docs_status = compute_documents_status(record)
        if docs_status == 'Complete':
            record.status = OnboardingRecord.Status.SUBMITTED
            record.submitted_at = timezone.now()
        else:
            record.status = OnboardingRecord.Status.DOCUMENTS_PENDING
    else:
        record.status = OnboardingRecord.Status.PROFILE_PENDING

    record.save(update_fields=['status', 'submitted_at', 'updated_at'])
    return document


def submit_onboarding(record: OnboardingRecord) -> OnboardingRecord:
    if not _profile_is_complete(record.profile_data):
        raise ValueError('Please complete all required profile fields before submitting.')
    if compute_documents_status(record) != 'Complete':
        raise ValueError('Please upload all required documents before submitting.')

    record.status = OnboardingRecord.Status.SUBMITTED
    record.submitted_at = timezone.now()
    record.save(update_fields=['status', 'submitted_at', 'updated_at'])
    return record


def start_onboarding_review(record: OnboardingRecord, reviewer) -> OnboardingRecord:
    if record.status != OnboardingRecord.Status.SUBMITTED:
        raise ValueError('Only submitted onboarding records can be moved to review.')
    record.status = OnboardingRecord.Status.UNDER_REVIEW
    record.reviewed_by = reviewer
    record.reviewed_at = timezone.now()
    record.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])
    return record


def request_onboarding_correction(record: OnboardingRecord, reason: str, reviewer) -> OnboardingRecord:
    if record.status not in {
        OnboardingRecord.Status.SUBMITTED,
        OnboardingRecord.Status.UNDER_REVIEW,
    }:
        raise ValueError('This onboarding record cannot be sent back for correction.')

    record.status = OnboardingRecord.Status.CORRECTION_REQUIRED
    record.correction_reason = (reason or '').strip()
    record.reviewed_by = reviewer
    record.reviewed_at = timezone.now()
    record.save(
        update_fields=[
            'status',
            'correction_reason',
            'reviewed_by',
            'reviewed_at',
            'updated_at',
        ],
    )
    return record


def _create_employee_from_onboarding(record: OnboardingRecord) -> Employee:
    profile = record.profile_data or {}
    first_name, last_name = split_candidate_name(record.candidate_name)
    first_name = profile.get('first_name') or first_name
    last_name = profile.get('last_name') or last_name
    email = record.email.lower().strip()

    if User.objects.filter(email__iexact=email).exists():
        user = User.objects.get(email__iexact=email)
        if hasattr(user, 'employee_profile'):
            employee = user.employee_profile
        else:
            raise ValueError('A user exists for this email but no employee profile is linked.')
    else:
        temporary_password = generate_temporary_password()
        user = User.objects.create_user(
            email=email,
            password=temporary_password,
            full_name=f'{first_name} {last_name}'.strip(),
            phone=profile.get('phone') or record.phone or '',
            role=User.Role.EMPLOYEE,
            must_change_password=True,
        )
        employee = Employee.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=profile.get('phone') or record.phone or '',
            alternate_phone=profile.get('alternate_phone', ''),
            gender=profile.get('gender', ''),
            date_of_birth=profile.get('date_of_birth') or None,
            joining_date=record.joining_date,
            department=record.department,
            designation=record.designation,
            reporting_manager=record.reporting_manager,
            employment_type=record.employment_type,
            work_location=record.work_location,
            status=Employee.Status.INACTIVE,
            address=profile.get('address', ''),
            emergency_contact_name=profile.get('emergency_contact_name', ''),
            emergency_contact_phone=profile.get('emergency_contact_phone', ''),
        )
        employee.temporary_password = temporary_password

    record.employee = employee
    record.save(update_fields=['employee', 'updated_at'])
    return employee


def _apply_profile_to_employee(record: OnboardingRecord, employee: Employee) -> Employee:
    profile = record.profile_data or {}
    if profile.get('first_name'):
        employee.first_name = profile['first_name']
    if profile.get('last_name'):
        employee.last_name = profile['last_name']
    if profile.get('phone'):
        employee.phone = profile['phone']
    employee.alternate_phone = profile.get('alternate_phone', employee.alternate_phone)
    employee.gender = profile.get('gender', employee.gender)
    employee.date_of_birth = profile.get('date_of_birth') or employee.date_of_birth
    employee.address = profile.get('address', employee.address)
    employee.emergency_contact_name = profile.get(
        'emergency_contact_name',
        employee.emergency_contact_name,
    )
    employee.emergency_contact_phone = profile.get(
        'emergency_contact_phone',
        employee.emergency_contact_phone,
    )
    employee.department = record.department
    employee.designation = record.designation
    employee.joining_date = record.joining_date
    employee.employment_type = record.employment_type
    employee.work_location = record.work_location
    employee.reporting_manager = record.reporting_manager
    employee.save()
    employee.user.full_name = employee.full_name
    employee.user.phone = employee.phone
    employee.user.save(update_fields=['full_name', 'phone', 'updated_at'])
    return employee


def complete_onboarding(record: OnboardingRecord, reviewer) -> OnboardingRecord:
    if record.status not in {
        OnboardingRecord.Status.SUBMITTED,
        OnboardingRecord.Status.UNDER_REVIEW,
    }:
        raise ValueError('Only submitted or under-review onboarding can be completed.')

    employee = record.employee
    if not employee:
        employee = _create_employee_from_onboarding(record)
    else:
        _apply_profile_to_employee(record, employee)

    employee.status = Employee.Status.ACTIVE
    employee.user.is_active = True
    employee.user.save(update_fields=['is_active', 'updated_at'])
    employee.save(update_fields=['status', 'updated_at'])

    record.status = OnboardingRecord.Status.COMPLETED
    record.reviewed_by = reviewer
    record.reviewed_at = timezone.now()
    record.completed_at = timezone.now()
    record.correction_reason = ''
    record.save(
        update_fields=[
            'status',
            'reviewed_by',
            'reviewed_at',
            'completed_at',
            'correction_reason',
            'updated_at',
        ],
    )
    return record
