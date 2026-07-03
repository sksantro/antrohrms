from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from payroll.models import EmployeePayrollDraft, EmployeePayrollProfile, PayrollRun, SalaryStructure
from payroll.payroll_draft_service import recalculate_net_pay
from payroll.payroll_run_service import (
    generate_payroll_drafts,
    get_month_bounds,
    validate_payroll_run_period,
)
from payroll.permissions import (
    IsEmployeeOwnSalaryAccess,
    IsSuperAdminPayrollProfileAccess,
    IsSuperAdminPayrollRunAccess,
    IsSuperAdminSalaryAccess,
)
from payroll.serializers import (
    EmployeePayrollDraftSerializer,
    EmployeePayrollDraftUpdateSerializer,
    EmployeePayrollProfileListSerializer,
    EmployeePayrollProfileSerializer,
    EmployeePayrollProfileWriteSerializer,
    PayrollRunCreateSerializer,
    PayrollRunListSerializer,
    PayrollRunSerializer,
    SalaryStructureCalculateSerializer,
    SalaryStructureSerializer,
    SalaryStructureWriteSerializer,
)
from payroll.salary_structure_calc import calculate_salary_components
from payroll.services import deactivate_other_active_structures


class SalaryStructureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSuperAdminSalaryAccess]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    queryset = SalaryStructure.objects.select_related(
        'employee',
        'created_by',
        'updated_by',
    ).all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return SalaryStructureWriteSerializer
        return SalaryStructureSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee')
        is_active = self.request.query_params.get('is_active')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if is_active in ('true', 'false'):
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        if instance.is_active:
            deactivate_other_active_structures(instance.employee_id, exclude_id=instance.pk)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        if instance.is_active:
            deactivate_other_active_structures(instance.employee_id, exclude_id=instance.pk)

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        structure = self.get_object()
        structure.is_active = True
        structure.updated_by = request.user
        structure.save(update_fields=['is_active', 'updated_by', 'updated_at'])
        deactivate_other_active_structures(structure.employee_id, exclude_id=structure.pk)
        return Response(SalaryStructureSerializer(structure).data)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        structure = self.get_object()
        structure.is_active = False
        structure.updated_by = request.user
        structure.save(update_fields=['is_active', 'updated_by', 'updated_at'])
        return Response(SalaryStructureSerializer(structure).data)

    @action(detail=False, methods=['post'], url_path='calculate')
    def calculate(self, request):
        serializer = SalaryStructureCalculateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = calculate_salary_components(
                annual_ctc=data.get('annual_ctc'),
                monthly_gross_salary=data.get('monthly_gross_salary'),
                pf_status=data.get('pf_status', SalaryStructure.PfStatus.NOT_APPLICABLE),
                conveyance_allowance=data.get('conveyance_allowance'),
                other_allowance=data.get('other_allowance'),
            )
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)}) from exc

        return Response({key: str(value) for key, value in result.items()})


class MySalaryStructureView(APIView):
    permission_classes = [IsAuthenticated, IsEmployeeOwnSalaryAccess]

    def get(self, request):
        profile = getattr(request.user, 'employee_profile', None)
        if not profile:
            return Response(
                {
                    'salary_structure': None,
                    'message': 'Employee profile not found.',
                },
                status=status.HTTP_200_OK,
            )

        structure = (
            SalaryStructure.objects.select_related('employee')
            .filter(employee=profile, is_active=True)
            .order_by('-effective_from', '-created_at')
            .first()
        )

        if not structure:
            return Response(
                {
                    'salary_structure': None,
                    'message': 'No active salary structure found.',
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                'salary_structure': SalaryStructureSerializer(structure).data,
                'message': None,
            },
            status=status.HTTP_200_OK,
        )


class PayrollRunViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsSuperAdminPayrollRunAccess]
    pagination_class = None
    queryset = PayrollRun.objects.select_related('generated_by').prefetch_related(
        'employee_drafts__employee',
        'employee_drafts__salary_structure',
        'employee_drafts__reviewed_by',
    ).all()

    def get_serializer_class(self):
        if self.action == 'list':
            return PayrollRunListSerializer
        return PayrollRunSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        year = self.request.query_params.get('year')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if year:
            queryset = queryset.filter(year=year)
        return queryset

    def create(self, request):
        serializer = PayrollRunCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        month = serializer.validated_data['month']
        year = serializer.validated_data['year']

        try:
            validate_payroll_run_period(month, year)
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)}) from exc

        start_date, end_date = get_month_bounds(year, month)
        with transaction.atomic():
            payroll_run = PayrollRun.objects.create(
                month=month,
                year=year,
                start_date=start_date,
                end_date=end_date,
                status=PayrollRun.Status.DRAFT,
            )
            generate_payroll_drafts(payroll_run, request.user)

        payroll_run = self.get_queryset().get(pk=payroll_run.pk)
        return Response(PayrollRunSerializer(payroll_run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='regenerate')
    def regenerate(self, request, pk=None):
        payroll_run = self.get_object()
        if payroll_run.status != PayrollRun.Status.DRAFT:
            return Response(
                {'detail': 'Only draft payroll runs can be regenerated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            generate_payroll_drafts(payroll_run, request.user)

        payroll_run.refresh_from_db()
        payroll_run = self.get_queryset().get(pk=payroll_run.pk)
        return Response(PayrollRunSerializer(payroll_run).data)

    @action(detail=True, methods=['post'], url_path='lock')
    def lock(self, request, pk=None):
        payroll_run = self.get_object()
        if payroll_run.status != PayrollRun.Status.DRAFT:
            return Response(
                {'detail': 'Only draft payroll runs can be locked.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payroll_run.status = PayrollRun.Status.LOCKED
        payroll_run.save(update_fields=['status', 'updated_at'])
        return Response(PayrollRunSerializer(self.get_queryset().get(pk=payroll_run.pk)).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        payroll_run = self.get_object()
        if payroll_run.status == PayrollRun.Status.CANCELLED:
            return Response(
                {'detail': 'Payroll run is already cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if payroll_run.status == PayrollRun.Status.LOCKED:
            return Response(
                {'detail': 'Locked payroll runs cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payroll_run.status = PayrollRun.Status.CANCELLED
        payroll_run.save(update_fields=['status', 'updated_at'])
        return Response(PayrollRunSerializer(self.get_queryset().get(pk=payroll_run.pk)).data)


class EmployeePayrollDraftViewSet(
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsSuperAdminPayrollRunAccess]
    queryset = EmployeePayrollDraft.objects.select_related(
        'payroll_run',
        'employee',
        'reviewed_by',
    ).all()
    http_method_names = ['patch', 'head', 'options']

    def get_serializer_class(self):
        return EmployeePayrollDraftUpdateSerializer

    def partial_update(self, request, *args, **kwargs):
        draft = self.get_object()
        payroll_run = draft.payroll_run

        if payroll_run.status != PayrollRun.Status.DRAFT:
            return Response(
                {'detail': 'Payroll draft rows can only be edited when the payroll run is in draft status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if draft.status != EmployeePayrollDraft.Status.READY:
            return Response(
                {'detail': 'Only ready payroll draft rows can be adjusted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(draft, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(draft, field, value)

        draft.net_pay = recalculate_net_pay(draft)
        draft.reviewed_by = request.user
        draft.reviewed_at = timezone.now()
        draft.save()

        return Response(EmployeePayrollDraftSerializer(draft).data)


class EmployeePayrollProfileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSuperAdminPayrollProfileAccess]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    queryset = EmployeePayrollProfile.objects.select_related(
        'employee',
        'created_by',
        'updated_by',
    ).all()

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeePayrollProfileListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EmployeePayrollProfileWriteSerializer
        return EmployeePayrollProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active in ('true', 'false'):
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        profile = self.get_object()
        profile.is_active = False
        profile.updated_by = request.user
        profile.save(update_fields=['is_active', 'updated_by', 'updated_at'])
        return Response(EmployeePayrollProfileSerializer(profile).data)
