from django.urls import path

from leads.kpi_views import KpiSummaryView
from leads.sales_command_center_views import (
    SalesCommandCenterEmployeeDetailView,
    SalesCommandCenterEmployeesView,
    SalesCommandCenterSummaryView,
)
from leads.sales_risk_views import (
    SalesRiskDashboardView,
    SalesRiskEventListView,
    SalesRiskEventResolveView,
)

urlpatterns = [
    path('kpi-summary/', KpiSummaryView.as_view(), name='kpi-summary'),
    path('command-center/summary/', SalesCommandCenterSummaryView.as_view(), name='sales-command-center-summary'),
    path('command-center/employees/', SalesCommandCenterEmployeesView.as_view(), name='sales-command-center-employees'),
    path(
        'command-center/employees/<int:user_id>/',
        SalesCommandCenterEmployeeDetailView.as_view(),
        name='sales-command-center-employee-detail',
    ),
    path('risk-dashboard/', SalesRiskDashboardView.as_view(), name='sales-risk-dashboard'),
    path('alerts/', SalesRiskEventListView.as_view(), name='sales-risk-alerts'),
    path('alerts/<int:alert_id>/resolve/', SalesRiskEventResolveView.as_view(), name='sales-risk-alert-resolve'),
]