from django.urls import include, path
from rest_framework.routers import DefaultRouter

from leads import bulk_upload_views, views

app_name = 'leads'

router = DefaultRouter()
router.register('', views.LeadViewSet, basename='lead')

contact_list = views.LeadContactViewSet.as_view({'get': 'list', 'post': 'create'})
contact_detail = views.LeadContactViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

activity_list = views.LeadActivityViewSet.as_view({'get': 'list', 'post': 'create'})
activity_detail = views.LeadActivityViewSet.as_view({
    'get': 'retrieve',
    'patch': 'partial_update',
})

urlpatterns = [
    path('bulk-upload/parse/', bulk_upload_views.LeadBulkUploadParseView.as_view(), name='lead-bulk-upload-parse'),
    path('bulk-upload/preview/', bulk_upload_views.LeadBulkUploadPreviewView.as_view(), name='lead-bulk-upload-preview'),
    path('bulk-upload/import/', bulk_upload_views.LeadBulkUploadImportView.as_view(), name='lead-bulk-upload-import'),
    path('import-history/', bulk_upload_views.LeadImportHistoryListView.as_view(), name='lead-import-history'),
    path('<int:lead_pk>/contacts/', contact_list, name='lead-contact-list'),
    path('<int:lead_pk>/contacts/<int:pk>/', contact_detail, name='lead-contact-detail'),
    path('<int:lead_pk>/activities/', activity_list, name='lead-activity-list'),
    path('<int:lead_pk>/activities/<int:pk>/', activity_detail, name='lead-activity-detail'),
    path('', include(router.urls)),
]
