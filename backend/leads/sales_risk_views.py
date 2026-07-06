from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from leads.kpi_views import SalesKpiPermission
from leads.models import SalesRiskEvent
from leads.risk_events import get_employee_risk_dashboard
from leads.sales_command_center_views import SuperAdminSalesCommandCenterPermission


class SalesRiskDashboardView(APIView):
    permission_classes = [SalesKpiPermission]

    def get(self, request):
        return Response(get_employee_risk_dashboard(request.user))


class SalesRiskEventListView(APIView):
    permission_classes = [SuperAdminSalesCommandCenterPermission]

    def get(self, request):
        queryset = SalesRiskEvent.objects.select_related(
            'employee',
            'lead',
            'activity',
            'resolved_by',
        )

        employee_id = request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        severity = request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity.upper())

        alert_type = request.query_params.get('alert_type')
        if alert_type:
            queryset = queryset.filter(alert_type=alert_type)

        date_value = request.query_params.get('date')
        if date_value:
            queryset = queryset.filter(created_at__date=date_value)

        resolved = request.query_params.get('resolved')
        if resolved == 'true':
            queryset = queryset.filter(is_resolved=True)
        elif resolved == 'false':
            queryset = queryset.filter(is_resolved=False)

        alerts = []
        for event in queryset.order_by('-created_at')[:100]:
            alerts.append({
                'id': event.id,
                'employee_id': event.employee_id,
                'employee_name': event.employee.full_name or event.employee.email,
                'lead_id': event.lead_id,
                'lead_name': event.lead.company_name if event.lead else None,
                'activity_id': event.activity_id,
                'alert_type': event.alert_type,
                'alert_type_display': event.get_alert_type_display(),
                'severity': event.severity,
                'severity_display': event.get_severity_display(),
                'message': event.message,
                'is_resolved': event.is_resolved,
                'created_at': event.created_at.isoformat(),
                'resolved_by_name': event.resolved_by.full_name if event.resolved_by else None,
                'resolved_at': event.resolved_at.isoformat() if event.resolved_at else None,
            })

        return Response({'alerts': alerts})


class SalesRiskEventResolveView(APIView):
    permission_classes = [SuperAdminSalesCommandCenterPermission]

    def post(self, request, alert_id: int):
        try:
            event = SalesRiskEvent.objects.get(pk=alert_id)
        except SalesRiskEvent.DoesNotExist:
            return Response({'detail': 'Alert not found.'}, status=status.HTTP_404_NOT_FOUND)

        if event.is_resolved:
            return Response({'detail': 'Alert is already resolved.'})

        event.is_resolved = True
        event.resolved_by = request.user
        event.resolved_at = timezone.now()
        event.save(update_fields=['is_resolved', 'resolved_by', 'resolved_at'])

        return Response({
            'id': event.id,
            'is_resolved': True,
            'resolved_by_name': request.user.full_name or request.user.email,
            'resolved_at': event.resolved_at.isoformat(),
        })
