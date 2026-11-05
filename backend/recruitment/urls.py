from django.urls import path

from . import views as v

urlpatterns = [
    path("hr/candidates", v.CandidatesView.as_view()),
    path("hr/candidates/<uuid:pk>", v.CandidateView.as_view()),
    path("hr/candidates/<uuid:pk>/withdraw", v.CandidateWithdrawView.as_view()),
    path("hr/candidates/<uuid:pk>/interviews", v.CandidateRoundsView.as_view()),
    path("hr/candidates/<uuid:pk>/offer", v.CandidateOfferView.as_view()),
    path("candidates/<uuid:pk>/resume", v.ResumeView.as_view()),
    path("hr/interviews/<uuid:pk>", v.RoundView.as_view()),
    path("hr/interviews/<uuid:pk>/cancel", v.RoundCancelView.as_view()),
    path("hr/offers/<uuid:pk>/<str:action>", v.OfferActionView.as_view()),
    path("interviews/assigned", v.AssignedView.as_view()),
    path("interviews/<uuid:pk>/feedback", v.FeedbackView.as_view()),
    path("admin/hiring", v.HiringView.as_view()),
    path("admin/candidates/<uuid:pk>/decision", v.CandidateDecisionView.as_view()),
    path("admin/offers/<uuid:pk>/decision", v.OfferDecisionView.as_view()),
    path("candidate/offers/<str:token>", v.CandidateOfferPublicView.as_view()),
]
