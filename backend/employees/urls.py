from django.urls import include, path
from rest_framework.routers import DefaultRouter

from employees import views

app_name = 'employees'

router = DefaultRouter()
router.register('', views.EmployeeViewSet, basename='employee')

urlpatterns = [
    path('', include(router.urls)),
]
