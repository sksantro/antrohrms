from django.urls import include, path
from rest_framework.routers import DefaultRouter

from settings_app import views
from settings_app.holiday_upload_views import HolidayUploadImportView, HolidayUploadPreviewView

app_name = 'settings_app'

router = DefaultRouter()
router.register('holidays', views.CompanyHolidayViewSet, basename='company-holiday')

urlpatterns = [
    path('company/', views.CompanySettingsView.as_view(), name='company-settings'),
    path('holidays/upload/preview/', HolidayUploadPreviewView.as_view(), name='holiday-upload-preview'),
    path('holidays/upload/import/', HolidayUploadImportView.as_view(), name='holiday-upload-import'),
    path('', include(router.urls)),
]
