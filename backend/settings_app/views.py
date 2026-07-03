from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from settings_app.models import CompanyHoliday, CompanySettings
from settings_app.permissions import CompanyHolidayPermission, CompanySettingsPermission
from settings_app.serializers import CompanyHolidaySerializer, CompanySettingsSerializer


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
        if active_only == 'false':
            queryset = CompanyHoliday.objects.all().order_by('date')
        if year:
            queryset = queryset.filter(date__year=year)
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
