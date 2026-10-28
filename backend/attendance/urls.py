from django.urls import path

from . import views as v

urlpatterns = [
    path("attendance/today", v.TodayView.as_view()),
    path("attendance/check-in", v.CheckInView.as_view()),
    path("attendance/break/start", v.BreakStartView.as_view()),
    path("attendance/break/resume", v.BreakResumeView.as_view()),
    path("attendance/check-out", v.CheckOutView.as_view()),
    path("attendance/verify-location", v.VerifyLocationView.as_view()),
    path("attendance/history", v.HistoryView.as_view()),
    path("attendance/days/<uuid:day_id>/corrections", v.RequestCorrectionView.as_view()),
    path("attendance/presence-checks/<uuid:check_id>/confirm", v.PresenceConfirmView.as_view()),
    path("attendance/wfh-requests", v.WfhRequestsView.as_view()),
    path("attendance/wfh-requests/<uuid:request_id>/cancel", v.WfhCancelView.as_view()),
    path("admin/attendance/today", v.AdminLiveView.as_view()),
    path("admin/attendance/exceptions", v.AdminExceptionsView.as_view()),
    path("admin/attendance/days/<uuid:day_id>", v.AdminDayView.as_view()),
    path("admin/attendance/days/<uuid:day_id>/review", v.AdminReviewDayView.as_view()),
    path("admin/attendance/corrections/<uuid:correction_id>/decision", v.AdminCorrectionDecisionView.as_view()),
    path("admin/office-site", v.AdminOfficeSiteView.as_view()),
    path("admin/wfh-requests/<uuid:request_id>/decision", v.AdminWfhDecisionView.as_view()),
]
