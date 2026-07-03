from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import AttendanceRegularization
from attendance.regularization_serializers import (
    AttendanceRegularizationApplySerializer,
    AttendanceRegularizationSerializer,
    RegularizationRejectSerializer,
)
from attendance.regularization_services import (
    approve_regularization,
    reject_regularization,
)


class AttendanceRegularizationViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRegularization.objects.select_related('employee').all()
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return AttendanceRegularizationApplySerializer
        return AttendanceRegularizationSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = AttendanceRegularization.objects.select_related('employee').all()
        status_filter = self.request.query_params.get('status')

        if user.is_super_admin or user.is_hr_admin:
            pass
        elif user.is_manager:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                return AttendanceRegularization.objects.none()
            queryset = queryset.filter(employee__reporting_manager=manager_profile)
        elif user.is_employee_user:
            profile = getattr(user, 'employee_profile', None)
            if not profile:
                return AttendanceRegularization.objects.none()
            queryset = queryset.filter(employee=profile)
        else:
            return AttendanceRegularization.objects.none()

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def _get_employee_profile(self, user):
        profile = getattr(user, 'employee_profile', None)
        if not profile:
            raise ValidationError({'detail': 'Employee profile not found.'})
        return profile

    def create(self, request, *args, **kwargs):
        profile = self._get_employee_profile(request.user)
        serializer = AttendanceRegularizationApplySerializer(
            data=request.data,
            context={'employee': profile, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        regularization = serializer.save()
        return Response(
            AttendanceRegularizationSerializer(regularization).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='my')
    def my_requests(self, request):
        profile = self._get_employee_profile(request.user)
        queryset = AttendanceRegularization.objects.filter(employee=profile)
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        serializer = AttendanceRegularizationSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        regularization = self.get_object()
        try:
            approve_regularization(regularization, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        regularization.refresh_from_db()
        return Response(AttendanceRegularizationSerializer(regularization).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        regularization = self.get_object()
        serializer = RegularizationRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reject_regularization(
                regularization,
                request.user,
                serializer.validated_data['rejection_reason'],
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        regularization.refresh_from_db()
        return Response(AttendanceRegularizationSerializer(regularization).data)
