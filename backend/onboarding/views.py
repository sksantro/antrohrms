from django.db import models
from django.shortcuts import get_object_or_404
import json

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from onboarding.models import OnboardingRecord
from onboarding.permissions import OnboardingEmployeePermission, OnboardingPermission
from onboarding.serializers import (
    OnboardingCreateSerializer,
    OnboardingPublicSerializer,
    OnboardingRecordSerializer,
    OnboardingReviewActionSerializer,
)
from onboarding.services import (
    complete_onboarding,
    request_onboarding_correction,
    resend_onboarding_invite,
    save_public_profile,
    send_onboarding_invite,
    start_onboarding_review,
    submit_onboarding,
    upload_onboarding_document,
)


class OnboardingViewSet(viewsets.ModelViewSet):
    permission_classes = [OnboardingPermission]
    queryset = OnboardingRecord.objects.select_related(
        'employee',
        'offer_letter',
        'reporting_manager',
        'created_by',
        'reviewed_by',
    ).prefetch_related('documents')
    pagination_class = None
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return OnboardingCreateSerializer
        return OnboardingRecordSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        department = self.request.query_params.get('department')
        designation = self.request.query_params.get('designation')
        joining_from = self.request.query_params.get('joining_from')
        joining_to = self.request.query_params.get('joining_to')
        search = self.request.query_params.get('search', '').strip()

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if department:
            queryset = queryset.filter(department=department)
        if designation:
            queryset = queryset.filter(designation__iexact=designation)
        if joining_from:
            queryset = queryset.filter(joining_date__gte=joining_from)
        if joining_to:
            queryset = queryset.filter(joining_date__lte=joining_to)
        if search:
            queryset = queryset.filter(
                models.Q(candidate_name__icontains=search)
                | models.Q(email__icontains=search)
                | models.Q(phone__icontains=search)
                | models.Q(onboarding_id__icontains=search)
                | models.Q(employee__employee_code__icontains=search)
            )
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        output = OnboardingRecordSerializer(record, context={'request': request})
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def send_invite(self, request, pk=None):
        record = self.get_object()
        try:
            send_onboarding_invite(record)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OnboardingRecordSerializer(record, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def resend_invite(self, request, pk=None):
        record = self.get_object()
        try:
            resend_onboarding_invite(record)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OnboardingRecordSerializer(record, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def start_review(self, request, pk=None):
        record = self.get_object()
        try:
            start_onboarding_review(record, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OnboardingRecordSerializer(record, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        record = self.get_object()
        try:
            complete_onboarding(record, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OnboardingRecordSerializer(record, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        record = self.get_object()
        serializer = OnboardingReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get('reason', '')
        if not reason.strip():
            return Response(
                {'detail': 'A correction reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            request_onboarding_correction(record, reason, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OnboardingRecordSerializer(record, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='complete')
    def mark_complete(self, request, pk=None):
        record = self.get_object()
        try:
            complete_onboarding(record, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OnboardingRecordSerializer(record, context={'request': request}).data)


class MyOnboardingView(APIView):
    permission_classes = [OnboardingEmployeePermission]

    def get(self, request):
        employee = request.user.employee_profile
        record = (
            OnboardingRecord.objects.filter(employee=employee)
            .exclude(status=OnboardingRecord.Status.COMPLETED)
            .order_by('-updated_at')
            .first()
        )
        if not record:
            return Response({'detail': 'No active onboarding record found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OnboardingRecordSerializer(record, context={'request': request}).data)


class PublicOnboardingView(APIView):
    authentication_classes = []
    permission_classes = []
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_record(self, token):
        return get_object_or_404(OnboardingRecord, invite_token=token)

    def _parse_json_field(self, value, default):
        if value is None:
            return default
        if isinstance(value, (dict, list)):
            return value
        if isinstance(value, str) and value.strip():
            return json.loads(value)
        return default

    def get(self, request, token):
        record = self.get_record(token)
        return Response(OnboardingPublicSerializer(record, context={'request': request}).data)

    def post(self, request, token):
        record = self.get_record(token)
        action_name = request.data.get('action')

        try:
            if action_name == 'save_profile':
                save_public_profile(
                    record,
                    self._parse_json_field(
                        request.data.get('profile_data') or request.data.get('profile'),
                        {},
                    ),
                    self._parse_json_field(request.data.get('education_details'), None),
                    self._parse_json_field(request.data.get('employment_history'), None),
                )
            elif action_name == 'upload_document':
                document_type = request.data.get('document_type')
                uploaded_file = request.FILES.get('file')
                if not uploaded_file:
                    return Response({'detail': 'File is required.'}, status=status.HTTP_400_BAD_REQUEST)
                upload_onboarding_document(record, document_type, uploaded_file)
            elif action_name == 'submit':
                submit_onboarding(record)
            else:
                return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        record.refresh_from_db()
        return Response(OnboardingPublicSerializer(record, context={'request': request}).data)

    def patch(self, request, token):
        record = self.get_record(token)
        try:
            save_public_profile(
                record,
                self._parse_json_field(request.data.get('profile_data'), dict(request.data)),
                self._parse_json_field(request.data.get('education_details'), None),
                self._parse_json_field(request.data.get('employment_history'), None),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record.refresh_from_db()
        return Response(OnboardingPublicSerializer(record, context={'request': request}).data)


class EmployeeOnboardingView(APIView):
    permission_classes = [IsAuthenticated, OnboardingEmployeePermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _parse_json_field(self, value, default):
        if value is None:
            return default
        if isinstance(value, (dict, list)):
            return value
        if isinstance(value, str) and value.strip():
            return json.loads(value)
        return default

    def get_active_record(self, request):
        employee = request.user.employee_profile
        return get_object_or_404(
            OnboardingRecord.objects.prefetch_related('documents'),
            employee=employee,
        )

    def get(self, request):
        try:
            record = (
                OnboardingRecord.objects.filter(employee=request.user.employee_profile)
                .exclude(status=OnboardingRecord.Status.COMPLETED)
                .order_by('-updated_at')
                .first()
            )
        except Exception:
            record = None
        if not record:
            return Response({'detail': 'No active onboarding record found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OnboardingPublicSerializer(record, context={'request': request}).data)

    def patch(self, request):
        record = self.get_active_record(request)
        try:
            save_public_profile(
                record,
                self._parse_json_field(request.data.get('profile_data'), dict(request.data)),
                self._parse_json_field(request.data.get('education_details'), None),
                self._parse_json_field(request.data.get('employment_history'), None),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record.refresh_from_db()
        return Response(OnboardingPublicSerializer(record, context={'request': request}).data)

    def post(self, request):
        record = self.get_active_record(request)
        action_name = request.data.get('action')
        try:
            if action_name == 'upload_document':
                upload_onboarding_document(
                    record,
                    request.data.get('document_type'),
                    request.FILES.get('file'),
                )
            elif action_name == 'submit':
                submit_onboarding(record)
            else:
                return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record.refresh_from_db()
        return Response(OnboardingPublicSerializer(record, context={'request': request}).data)
