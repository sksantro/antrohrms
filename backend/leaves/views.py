from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from leaves.models import LeaveBalance, LeaveRequest
from leaves.permissions import CanManageLeaveBalances, LeaveRequestPermission
from leaves.serializers import (
    LeaveApplySerializer,
    LeaveBalanceSerializer,
    LeaveBalanceUpdateSerializer,
    LeaveRejectSerializer,
    LeaveRequestSerializer,
)
from leaves.services import (
    approve_leave_cancellation,
    approve_leave_request,
    cancel_pending_leave,
    get_leave_balance,
    process_escalations,
    reject_leave_request,
    request_leave_cancellation,
)


class LeaveBalanceViewSet(viewsets.ModelViewSet):
    queryset = LeaveBalance.objects.select_related('employee').all()
    pagination_class = None
    http_method_names = ['get', 'patch', 'head', 'options']
    permission_classes = [IsAuthenticated, CanManageLeaveBalances]

    def get_serializer_class(self):
        if self.action == 'partial_update':
            return LeaveBalanceUpdateSerializer
        return LeaveBalanceSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = LeaveBalance.objects.select_related('employee').all()
        employee_id = self.request.query_params.get('employee')
        year = self.request.query_params.get('year')

        if user.is_super_admin or user.is_hr_admin or user.is_finance:
            pass
        elif user.is_manager:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                return LeaveBalance.objects.none()
            queryset = queryset.filter(
                Q(employee=manager_profile)
                | Q(employee__reporting_manager=manager_profile),
            )
        elif user.is_employee_user:
            profile = getattr(user, 'employee_profile', None)
            if not profile:
                return LeaveBalance.objects.none()
            queryset = queryset.filter(employee=profile)
        else:
            return LeaveBalance.objects.none()

        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if year:
            queryset = queryset.filter(year=year)
        return queryset


class MyLeaveBalanceView(APIView):
    permission_classes = [IsAuthenticated, LeaveRequestPermission]

    def get(self, request):
        profile = getattr(request.user, 'employee_profile', None)
        if not profile:
            raise ValidationError({'detail': 'Employee profile not found.'})
        year = int(request.query_params.get('year', timezone.now().year))
        balance = get_leave_balance(profile, year)
        return Response(LeaveBalanceSerializer(balance).data)


class LeaveRequestViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LeaveRequest.objects.select_related(
        'employee',
        'approved_by',
        'rejected_by',
    ).all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, LeaveRequestPermission]
    pagination_class = None

    def get_queryset(self):
        process_escalations()
        user = self.request.user
        queryset = LeaveRequest.objects.select_related(
            'employee',
            'approved_by',
            'rejected_by',
        ).all()

        status_filter = self.request.query_params.get('status')
        employee_id = self.request.query_params.get('employee')
        department = self.request.query_params.get('department')
        leave_type = self.request.query_params.get('leave_type')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        search = self.request.query_params.get('search', '').strip()
        escalated = self.request.query_params.get('escalated')
        special = self.request.query_params.get('special_approval')

        if user.is_super_admin or user.is_hr_admin:
            pass
        elif user.is_finance:
            queryset = queryset.filter(status=LeaveRequest.Status.APPROVED)
        elif user.is_manager:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                return LeaveRequest.objects.none()
            queryset = queryset.filter(employee__reporting_manager=manager_profile)
        elif user.is_employee_user:
            profile = getattr(user, 'employee_profile', None)
            if not profile:
                return LeaveRequest.objects.none()
            queryset = queryset.filter(employee=profile)
        else:
            return LeaveRequest.objects.none()

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if department:
            queryset = queryset.filter(employee__department__iexact=department)
        if leave_type:
            queryset = queryset.filter(leave_type=leave_type)
        if month:
            queryset = queryset.filter(start_date__month=month)
        if year:
            queryset = queryset.filter(start_date__year=year)
        if date_from:
            queryset = queryset.filter(end_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(start_date__lte=date_to)
        if search:
            queryset = queryset.filter(
                Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
                | Q(employee__email__icontains=search)
                | Q(employee__employee_code__icontains=search)
                | Q(employee__department__icontains=search)
            )
        if escalated == 'true':
            queryset = queryset.filter(escalated_to_hr=True)
        if special == 'true':
            queryset = queryset.filter(is_special_approval_required=True)

        return queryset

    def _get_employee_profile(self, user):
        profile = getattr(user, 'employee_profile', None)
        if not profile:
            raise ValidationError({'detail': 'Employee profile not found for this user.'})
        return profile

    @action(detail=False, methods=['post'], url_path='apply')
    def apply_leave(self, request):
        employee = self._get_employee_profile(request.user)
        serializer = LeaveApplySerializer(
            data=request.data,
            context={'employee': employee, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        leave_request = serializer.save()
        return Response(
            LeaveRequestSerializer(leave_request).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='my-requests')
    def my_requests(self, request):
        employee = self._get_employee_profile(request.user)
        queryset = LeaveRequest.objects.filter(employee=employee).select_related(
            'employee',
            'approved_by',
            'rejected_by',
        )
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        serializer = LeaveRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        leave_request = self.get_object()
        try:
            approve_leave_request(leave_request, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        leave_request.refresh_from_db()
        return Response(LeaveRequestSerializer(leave_request).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        leave_request = self.get_object()
        serializer = LeaveRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reject_leave_request(
                leave_request,
                request.user,
                serializer.validated_data['rejection_reason'],
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        leave_request.refresh_from_db()
        return Response(LeaveRequestSerializer(leave_request).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        leave_request = self.get_object()
        try:
            if leave_request.status == LeaveRequest.Status.CANCELLATION_REQUESTED:
                if not (request.user.is_super_admin or request.user.is_hr_admin):
                    return Response({'detail': 'Not permitted.'}, status=status.HTTP_403_FORBIDDEN)
                approve_leave_cancellation(leave_request, request.user)
            else:
                cancel_pending_leave(leave_request)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        leave_request.refresh_from_db()
        return Response(LeaveRequestSerializer(leave_request).data)

    @action(detail=True, methods=['post'], url_path='request-cancellation')
    def request_cancellation(self, request, pk=None):
        leave_request = self.get_object()
        try:
            request_leave_cancellation(leave_request)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        leave_request.refresh_from_db()
        return Response(LeaveRequestSerializer(leave_request).data)

    @action(detail=True, methods=['post'], url_path='approve-cancellation')
    def approve_cancellation(self, request, pk=None):
        leave_request = self.get_object()
        if not (request.user.is_super_admin or request.user.is_hr_admin):
            return Response({'detail': 'Not permitted.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            approve_leave_cancellation(leave_request, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        leave_request.refresh_from_db()
        return Response(LeaveRequestSerializer(leave_request).data)
