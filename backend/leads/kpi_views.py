from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from leads.kpi import VALID_PERIODS, get_kpi_summary
from leads.permissions import user_can_access_leads


class SalesKpiPermission(BasePermission):
    message = 'Only Super Admin and Sales & Marketing users can access sales KPIs.'

    def has_permission(self, request, view):
        return user_can_access_leads(request.user)


class KpiSummaryView(APIView):
    permission_classes = [SalesKpiPermission]

    def get(self, request):
        period = request.query_params.get('period', 'daily')
        if period not in VALID_PERIODS:
            return Response(
                {'detail': 'Invalid period. Use daily, weekly, monthly, or quarterly.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(get_kpi_summary(request.user, period=period))
