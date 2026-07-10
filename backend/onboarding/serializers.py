from django.db import IntegrityError
from rest_framework import serializers

from employees.models import Employee
from offer_letters.models import OfferLetter

from onboarding.models import OnboardingDocument, OnboardingRecord
from onboarding.services import (
    compute_documents_status,
    create_onboarding_from_offer,
    link_employee_to_onboarding,
)


class OnboardingDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingDocument
        fields = (
            'id',
            'document_type',
            'original_filename',
            'file_url',
            'uploaded_at',
        )

    def get_file_url(self, obj):
        request = self.context.get('request')
        if not obj.file:
            return None
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class OnboardingRecordSerializer(serializers.ModelSerializer):
    documents = OnboardingDocumentSerializer(many=True, read_only=True)
    documents_status = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    invite_url = serializers.SerializerMethodField()
    offer_id = serializers.SerializerMethodField()
    reporting_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingRecord
        fields = (
            'id',
            'onboarding_id',
            'employee',
            'employee_code',
            'offer_letter',
            'offer_id',
            'candidate_name',
            'email',
            'phone',
            'department',
            'designation',
            'joining_date',
            'employment_type',
            'work_location',
            'reporting_manager',
            'reporting_manager_name',
            'status',
            'documents_status',
            'invite_token',
            'invite_url',
            'invited_at',
            'submitted_at',
            'reviewed_at',
            'completed_at',
            'correction_reason',
            'profile_data',
            'education_details',
            'employment_history',
            'documents',
            'created_at',
            'updated_at',
        )

    def get_documents_status(self, obj):
        return compute_documents_status(obj)

    def get_employee_code(self, obj):
        return obj.employee.employee_code if obj.employee else None

    def get_offer_id(self, obj):
        return obj.offer_letter.offer_id if obj.offer_letter else None

    def get_reporting_manager_name(self, obj):
        if obj.reporting_manager:
            return obj.reporting_manager.full_name
        return None

    def get_invite_url(self, obj):
        request = self.context.get('request')
        path = f'/onboarding/{obj.invite_token}'
        if request:
            return request.build_absolute_uri(path)
        return path


class OnboardingCreateSerializer(serializers.Serializer):
    offer_letter_id = serializers.IntegerField(required=False)
    employee_id = serializers.IntegerField(required=False)
    candidate_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    department = serializers.ChoiceField(
        choices=Employee.Department.choices,
        required=False,
        allow_blank=True,
    )
    designation = serializers.CharField(required=False, allow_blank=True)
    joining_date = serializers.DateField(required=False)
    employment_type = serializers.ChoiceField(
        choices=Employee.EmploymentType.choices,
        required=False,
    )
    work_location = serializers.CharField(required=False, allow_blank=True)
    reporting_manager_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        offer_id = attrs.get('offer_letter_id')
        employee_id = attrs.get('employee_id')
        if not offer_id and not employee_id and not attrs.get('email'):
            raise serializers.ValidationError(
                'Provide an offer letter, employee, or manual candidate details.',
            )
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        offer_id = validated_data.pop('offer_letter_id', None)
        employee_id = validated_data.pop('employee_id', None)
        reporting_manager_id = validated_data.pop('reporting_manager_id', None)

        reporting_manager = None
        if reporting_manager_id:
            reporting_manager = Employee.objects.filter(pk=reporting_manager_id).first()

        if offer_id:
            offer = OfferLetter.objects.filter(pk=offer_id).first()
            if not offer:
                raise serializers.ValidationError({'offer_letter_id': ['Offer letter not found.']})
            if offer.status != OfferLetter.Status.ACCEPTED:
                raise serializers.ValidationError(
                    {'offer_letter_id': ['Onboarding can only be created from accepted offers.']},
                )
            try:
                record = create_onboarding_from_offer(offer, created_by=request.user)
            except ValueError as exc:
                raise serializers.ValidationError({'email': [str(exc)]}) from exc
            if employee_id:
                employee = Employee.objects.filter(pk=employee_id).first()
                if employee:
                    link_employee_to_onboarding(record, employee)
            return record

        if employee_id:
            employee = Employee.objects.filter(pk=employee_id).first()
            if not employee:
                raise serializers.ValidationError({'employee_id': ['Employee not found.']})
            if OnboardingRecord.objects.filter(employee=employee).exclude(
                status=OnboardingRecord.Status.COMPLETED,
            ).exists():
                raise serializers.ValidationError(
                    {'employee_id': ['This employee already has an active onboarding record.']},
                )
            try:
                record = OnboardingRecord.objects.create(
                    employee=employee,
                    candidate_name=employee.full_name,
                    email=employee.email,
                    phone=employee.phone,
                    department=employee.department,
                    designation=employee.designation,
                    joining_date=employee.joining_date,
                    employment_type=employee.employment_type,
                    work_location=employee.work_location,
                    reporting_manager=employee.reporting_manager,
                    status=OnboardingRecord.Status.NOT_STARTED,
                    created_by=request.user,
                )
            except IntegrityError as exc:
                raise serializers.ValidationError(
                    'Unable to create onboarding for this employee.',
                ) from exc
            link_employee_to_onboarding(record, employee)
            return record

        email = validated_data.get('email', '').lower().strip()
        if not email:
            raise serializers.ValidationError({'email': ['Email is required for manual onboarding.']})
        if not validated_data.get('joining_date'):
            raise serializers.ValidationError({'joining_date': ['Joining date is required.']})
        if not validated_data.get('candidate_name', '').strip():
            raise serializers.ValidationError({'candidate_name': ['Candidate name is required.']})
        if OnboardingRecord.objects.filter(email__iexact=email).exclude(
            status=OnboardingRecord.Status.COMPLETED,
        ).exists():
            raise serializers.ValidationError({'email': ['An active onboarding record exists for this email.']})

        try:
            return OnboardingRecord.objects.create(
                candidate_name=validated_data.get('candidate_name', '').strip(),
                email=email,
                phone=validated_data.get('phone', ''),
                department=validated_data.get('department') or Employee.Department.TECHNOLOGY,
                designation=validated_data.get('designation', '').strip() or 'Employee',
                joining_date=validated_data.get('joining_date'),
                employment_type=validated_data.get(
                    'employment_type',
                    Employee.EmploymentType.FULL_TIME,
                ),
                work_location=validated_data.get('work_location', ''),
                reporting_manager=reporting_manager,
                status=OnboardingRecord.Status.NOT_STARTED,
                created_by=request.user,
            )
        except IntegrityError as exc:
            raise serializers.ValidationError(
                'Unable to create onboarding. Please check the provided details.',
            ) from exc


class OnboardingPublicSerializer(serializers.ModelSerializer):
    documents = OnboardingDocumentSerializer(many=True, read_only=True)
    documents_status = serializers.SerializerMethodField()
    required_documents = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingRecord
        fields = (
            'onboarding_id',
            'candidate_name',
            'email',
            'department',
            'designation',
            'joining_date',
            'status',
            'documents_status',
            'correction_reason',
            'profile_data',
            'education_details',
            'employment_history',
            'documents',
            'required_documents',
        )

    def get_documents_status(self, obj):
        return compute_documents_status(obj)

    def get_required_documents(self, obj):
        return [
            OnboardingDocument.DocumentType.AADHAAR,
            OnboardingDocument.DocumentType.PAN,
            OnboardingDocument.DocumentType.RESUME,
            OnboardingDocument.DocumentType.PHOTO,
            OnboardingDocument.DocumentType.EDUCATION_CERTIFICATE,
            OnboardingDocument.DocumentType.EXPERIENCE_RELIVING,
        ]


class OnboardingReviewActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
