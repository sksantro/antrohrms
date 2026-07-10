from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from settings_app.models import (
    CompanyHoliday,
    CompanySettings,
    DepartmentMaster,
    DesignationMaster,
    LeaveTypeMaster,
    PolicyCategoryMaster,
)
from settings_app.permissions import (
    CompanyHolidayPermission,
    CompanySettingsPermission,
    HRMasterDataPermission,
)
from settings_app.serializers import (
    CompanyHolidaySerializer,
    CompanySettingsSerializer,
    DepartmentMasterSerializer,
    DesignationMasterSerializer,
    LeaveTypeMasterSerializer,
    PolicyCategoryMasterSerializer,
)


class CompanySettingsView(APIView):
    permission_classes = [IsAuthenticated, CompanySettingsPermission]

    def get(self, request):
        settings = CompanySettings.get_settings()
        return Response(CompanySettingsSerializer(settings).data)

    def patch(self, request):
        settings = CompanySettings.get_settings()
        serializer = CompanySettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CompanyHolidayViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CompanyHolidayPermission]
    serializer_class = CompanyHolidaySerializer
    pagination_class = None
    queryset = CompanyHoliday.objects.all().order_by('date')

    def get_queryset(self):
        queryset = CompanyHoliday.objects.filter(is_active=True).order_by('date')
        active_only = self.request.query_params.get('active')
        year = self.request.query_params.get('year')
        search = (self.request.query_params.get('search') or '').strip()
        if active_only == 'false':
            queryset = CompanyHoliday.objects.all().order_by('date')
        if year:
            queryset = queryset.filter(date__year=year)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    @action(detail=True, methods=['post'], url_path='toggle-optional')
    def toggle_optional(self, request, pk=None):
        if not (request.user.is_super_admin or request.user.is_hr_admin):
            return Response({'detail': 'Not permitted.'}, status=status.HTTP_403_FORBIDDEN)

        holiday = self.get_object()
        if holiday.holiday_type == CompanyHoliday.HolidayType.OPTIONAL_HOLIDAY:
            holiday.holiday_type = holiday.base_holiday_type
        else:
            if holiday.holiday_type != CompanyHoliday.HolidayType.OPTIONAL_HOLIDAY:
                holiday.base_holiday_type = holiday.holiday_type
            holiday.holiday_type = CompanyHoliday.HolidayType.OPTIONAL_HOLIDAY
        holiday.save(update_fields=['holiday_type', 'base_holiday_type', 'updated_at'])
        return Response(CompanyHolidaySerializer(holiday).data)

    def destroy(self, request, *args, **kwargs):
        holiday = self.get_object()
        holiday.is_active = False
        holiday.save(update_fields=['is_active', 'updated_at'])
        return Response(
            {'detail': 'Holiday deactivated successfully.'},
            status=status.HTTP_200_OK,
        )


class SoftDeactivateMasterMixin:
    """DELETE soft-deactivates instead of hard-deleting master rows."""

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        return Response(
            {'detail': 'Deactivated successfully.'},
            status=status.HTTP_200_OK,
        )


class DepartmentMasterViewSet(SoftDeactivateMasterMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HRMasterDataPermission]
    serializer_class = DepartmentMasterSerializer
    pagination_class = None
    queryset = DepartmentMaster.objects.all()

    def get_queryset(self):
        queryset = DepartmentMaster.objects.all().order_by('name')
        active = self.request.query_params.get('active')
        search = (self.request.query_params.get('search') or '').strip()
        if active == 'true':
            queryset = queryset.filter(is_active=True)
        elif active == 'false':
            queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    @action(detail=True, methods=['post'], url_path='set-active')
    def set_active(self, request, pk=None):
        department = self.get_object()
        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'detail': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)
        department.is_active = bool(is_active)
        department.save(update_fields=['is_active', 'updated_at'])
        return Response(DepartmentMasterSerializer(department).data)


class DesignationMasterViewSet(SoftDeactivateMasterMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HRMasterDataPermission]
    serializer_class = DesignationMasterSerializer
    pagination_class = None
    queryset = DesignationMaster.objects.select_related('department').all()

    def get_queryset(self):
        queryset = DesignationMaster.objects.select_related('department').all().order_by('name')
        active = self.request.query_params.get('active')
        search = (self.request.query_params.get('search') or '').strip()
        department = self.request.query_params.get('department')
        if active == 'true':
            queryset = queryset.filter(is_active=True)
        elif active == 'false':
            queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(name__icontains=search)
        if department:
            queryset = queryset.filter(department_id=department)
        return queryset

    @action(detail=True, methods=['post'], url_path='set-active')
    def set_active(self, request, pk=None):
        designation = self.get_object()
        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'detail': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)
        designation.is_active = bool(is_active)
        designation.save(update_fields=['is_active', 'updated_at'])
        return Response(DesignationMasterSerializer(designation).data)


class LeaveTypeMasterViewSet(SoftDeactivateMasterMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HRMasterDataPermission]
    serializer_class = LeaveTypeMasterSerializer
    pagination_class = None
    queryset = LeaveTypeMaster.objects.all()

    def get_queryset(self):
        queryset = LeaveTypeMaster.objects.all().order_by('name')
        active = self.request.query_params.get('active')
        search = (self.request.query_params.get('search') or '').strip()
        if active == 'true':
            queryset = queryset.filter(is_active=True)
        elif active == 'false':
            queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(name__icontains=search) | queryset.filter(code__icontains=search)
        return queryset.distinct()

    @action(detail=True, methods=['post'], url_path='set-active')
    def set_active(self, request, pk=None):
        leave_type = self.get_object()
        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'detail': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)
        leave_type.is_active = bool(is_active)
        leave_type.save(update_fields=['is_active', 'updated_at'])
        return Response(LeaveTypeMasterSerializer(leave_type).data)


class PolicyCategoryMasterViewSet(SoftDeactivateMasterMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HRMasterDataPermission]
    serializer_class = PolicyCategoryMasterSerializer
    pagination_class = None
    queryset = PolicyCategoryMaster.objects.all()

    def get_queryset(self):
        queryset = PolicyCategoryMaster.objects.all().order_by('name')
        active = self.request.query_params.get('active')
        search = (self.request.query_params.get('search') or '').strip()
        if active == 'true':
            queryset = queryset.filter(is_active=True)
        elif active == 'false':
            queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(name__icontains=search) | queryset.filter(code__icontains=search)
        return queryset.distinct()

    @action(detail=True, methods=['post'], url_path='set-active')
    def set_active(self, request, pk=None):
        category = self.get_object()
        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'detail': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)
        category.is_active = bool(is_active)
        category.save(update_fields=['is_active', 'updated_at'])
        return Response(PolicyCategoryMasterSerializer(category).data)
