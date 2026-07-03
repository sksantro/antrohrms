from django.urls import include, path
from rest_framework.routers import DefaultRouter

from attendance import views
from attendance.regularization_views import AttendanceRegularizationViewSet

app_name = 'attendance'

router = DefaultRouter()
router.register('', views.AttendanceViewSet, basename='attendance')

regularization_router = DefaultRouter()
regularization_router.register('', AttendanceRegularizationViewSet, basename='attendance-regularization')

urlpatterns = [
    path(
        'regularization/my/',
        AttendanceRegularizationViewSet.as_view({'get': 'my_requests'}),
        name='regularization-my',
    ),
    path('regularization/', include(regularization_router.urls)),
    path('', include(router.urls)),
]
