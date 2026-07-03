from django.urls import include, path
from rest_framework.routers import DefaultRouter

from payroll import views

app_name = 'payroll'

router = DefaultRouter()
router.register('salary-structures', views.SalaryStructureViewSet, basename='salary-structure')
router.register('runs', views.PayrollRunViewSet, basename='payroll-run')
router.register('drafts', views.EmployeePayrollDraftViewSet, basename='payroll-draft')
router.register('profiles', views.EmployeePayrollProfileViewSet, basename='payroll-profile')

urlpatterns = [
    path('my-salary-structure/', views.MySalaryStructureView.as_view(), name='my-salary-structure'),
    path('', include(router.urls)),
]
