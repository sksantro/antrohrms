from django.urls import path

from . import views as v

urlpatterns = [
    path("holidays/calendar", v.HolidayCalendarView.as_view()),
    path("holidays/optional-selections", v.OptionalChoiceView.as_view()),
    path("hr/holidays/drafts", v.HolidayDraftsView.as_view()),
    path("hr/holidays/drafts/<uuid:pk>", v.HolidayDraftView.as_view()),
    path("hr/holidays/drafts/<uuid:pk>/submit", v.HolidayDraftSubmitView.as_view()),
    path("admin/holidays/<uuid:pk>/decision", v.HolidayDecisionView.as_view()),
    path("leave/balances", v.LeaveBalancesView.as_view()),
    path("leave/preview", v.LeavePreviewView.as_view()),
    path("leave/requests", v.LeaveRequestsView.as_view()),
    path("leave/requests/<uuid:pk>", v.LeaveRequestView.as_view()),
    path("leave/requests/<uuid:pk>/cancel", v.LeaveCancelView.as_view()),
    path("admin/leave/requests", v.AdminLeaveRequestsView.as_view()),
    path("admin/leave/requests/<uuid:pk>/decision", v.AdminLeaveDecisionView.as_view()),
    path("admin/leave/balances/<uuid:employee_id>", v.AdminLeaveBalanceView.as_view()),
]
