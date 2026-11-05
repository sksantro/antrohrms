from django.urls import path

from . import views as v

urlpatterns = [
    path("hr/onboarding", v.OnboardingView.as_view()),
    path("hr/onboarding/<uuid:pk>/request-documents", v.RequestDocsView.as_view()),
    path("hr/onboarding/<uuid:pk>/checklist", v.ChecklistView.as_view()),
    path("hr/onboarding/<uuid:pk>/join", v.JoinView.as_view()),
    path("hr/documents/<uuid:pk>/review", v.ReviewDocView.as_view()),
    path("documents/<uuid:pk>/file", v.DocFileView.as_view()),
    path("candidate/portal/session", v.PortalSessionView.as_view()),
    path("candidate/portal/<str:token>/otp", v.PortalOtpView.as_view()),
    path("candidate/portal/<str:token>/verify", v.PortalVerifyView.as_view()),
    path("hr/letters", v.LettersView.as_view()),
    path("letters/<uuid:pk>", v.LetterView.as_view()),
    path("hr/letters/<uuid:pk>/submit", v.LetterSubmitView.as_view()),
    path("admin/letters", v.AdminLettersView.as_view()),
    path("admin/letters/<uuid:pk>/decision", v.LetterDecisionView.as_view()),
    path("admin/letter-templates", v.TemplatesView.as_view()),
    path("documents/me", v.MyDocumentsView.as_view()),
    path("hr/probation/<uuid:pk>/review", v.ProbationStartView.as_view()),
    path("admin/probation/<uuid:pk>/decision", v.ProbationDecisionView.as_view()),
]
