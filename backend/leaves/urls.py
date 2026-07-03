from django.urls import include, path
from rest_framework.routers import DefaultRouter

from leaves import views

app_name = 'leaves'

router = DefaultRouter()
router.register('balances', views.LeaveBalanceViewSet, basename='leave-balance')
router.register('requests', views.LeaveRequestViewSet, basename='leave-request')

urlpatterns = [
    path('balance/my/', views.MyLeaveBalanceView.as_view(), name='my-leave-balance'),
    path('apply/', views.LeaveRequestViewSet.as_view({'post': 'apply_leave'}), name='leave-apply'),
    path(
        'my-requests/',
        views.LeaveRequestViewSet.as_view({'get': 'my_requests'}),
        name='my-leave-requests',
    ),
    path('', include(router.urls)),
]
