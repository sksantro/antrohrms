from django.urls import include, path
from rest_framework.routers import DefaultRouter

from policies import views

app_name = 'policies'

router = DefaultRouter()
router.register('', views.PolicyViewSet, basename='policy')

urlpatterns = [
    path('acknowledgements/', views.PolicyAcknowledgementListView.as_view(), name='acknowledgements'),
    path('pending-summary/', views.PolicyPendingSummaryView.as_view(), name='pending-summary'),
    path('', include(router.urls)),
]
