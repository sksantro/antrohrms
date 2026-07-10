from django.urls import path
from rest_framework.routers import DefaultRouter

from onboarding.views import (
    EmployeeOnboardingView,
    MyOnboardingView,
    OnboardingViewSet,
    PublicOnboardingView,
)

router = DefaultRouter()
router.register('', OnboardingViewSet, basename='onboarding')

urlpatterns = [
    path('me/', MyOnboardingView.as_view(), name='onboarding-me'),
    path('employee/', EmployeeOnboardingView.as_view(), name='onboarding-employee'),
    path('public/<uuid:token>/', PublicOnboardingView.as_view(), name='onboarding-public'),
    *router.urls,
]
