from django.urls import path

from audit_logs import views

app_name = 'audit_logs'

urlpatterns = [
    path('', views.AuditLogsPlaceholderView.as_view(), name='placeholder'),
]
