"""
URL configuration for antro-hrms project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import ChangePasswordView, CustomTokenObtainPairView, LogoutView, MeView
from config.views import health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/auth/me/', MeView.as_view(), name='auth-me'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/accounts/', include('accounts.urls')),
    path('api/employees/', include('employees.urls')),
    path('api/attendance/', include('attendance.urls')),
    path('api/leaves/', include('leaves.urls')),
    path('api/payroll/', include('payroll.urls')),
    path('api/documents/', include('documents.urls')),
    path('api/policies/', include('policies.urls')),
    path('api/leads/', include('leads.urls')),
    path('api/offer-letters/', include('offer_letters.urls')),
    path('api/onboarding/', include('onboarding.urls')),
    path('api/sales/', include('leads.sales_urls')),
    path('api/settings/', include('settings_app.urls')),
    path('api/audit-logs/', include('audit_logs.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
