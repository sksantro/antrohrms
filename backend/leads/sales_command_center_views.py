from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from leads.sales_command_center import (
    COMMAND_CENTER_PERIODS,
    get_employee_detail,
    get_employee_kpi_rows,
    get_sales_team_users,
    get_team_summary,
    parse_reference_date,
)


class SuperAdminSalesCommandCenterPermission(BasePermission):
    message = 'Only Super Admin can access the Sales Command Center.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_super_admin)


class SalesCommandCenterSummaryView(APIView):
    permission_classes = [SuperAdminSalesCommandCenterPermission]

    def get(self, request):
        try:
            reference_date = parse_reference_date(request.query_params.get('date'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        summary = get_team_summary(
            reference_date=reference_date,
            service_fit=request.query_params.get('service_fit') or None,
            lead_status=request.query_params.get('lead_status') or None,
        )
        return Response(summary)


class SalesCommandCenterEmployeesView(APIView):
    permission_classes = [SuperAdminSalesCommandCenterPermission]

    def get(self, request):
        period = request.query_params.get('period', 'daily')
        if period not in COMMAND_CENTER_PERIODS:
            return Response(
                {'detail': 'Invalid period. Use daily, weekly, or monthly.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee_id = request.query_params.get('employee_id')
        try:
            reference_date = parse_reference_date(request.query_params.get('date'))
            employee_id_int = int(employee_id) if employee_id else None
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = get_employee_kpi_rows(
                reference_date=reference_date,
                period=period,
                employee_id=employee_id_int,
                kpi_status=request.query_params.get('kpi_status') or None,
                service_fit=request.query_params.get('service_fit') or None,
                lead_status=request.query_params.get('lead_status') or None,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(payload)


class SalesCommandCenterEmployeeDetailView(APIView):
    permission_classes = [SuperAdminSalesCommandCenterPermission]

    def get(self, request, user_id: int):
        period = request.query_params.get('period', 'daily')
        if period not in COMMAND_CENTER_PERIODS:
            return Response(
                {'detail': 'Invalid period. Use daily, weekly, or monthly.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reference_date = parse_reference_date(request.query_params.get('date'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not get_sales_team_users().filter(id=user_id).exists():
            return Response({'detail': 'Sales employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payload = get_employee_detail(user_id, reference_date=reference_date, period=period)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(payload)
