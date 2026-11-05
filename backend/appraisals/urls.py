from django.urls import path

from . import views as v

urlpatterns = [
    path("appraisal/me", v.MyAppraisalView.as_view()),
    path("appraisal/<uuid:pk>/files/<uuid:fid>", v.AttachmentView.as_view()),
    path("appraisal/<uuid:pk>/<str:action>", v.MyAppraisalActionView.as_view()),
    path("manager/reviews", v.TeamReviewsView.as_view()),
    path("manager/reviews/<uuid:pk>/<str:action>", v.TeamReviewActionView.as_view()),
    path("hr/appraisals", v.HRAppraisalsView.as_view()),
    path("admin/appraisals", v.AdminAppraisalsView.as_view()),
    path("admin/appraisals/<uuid:pk>/decision", v.AdminDecisionView.as_view()),
]
