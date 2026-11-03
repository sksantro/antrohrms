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
    path("holiday-work/requests", v.HolidayWorkListView.as_view()),
    path("holiday-work/<uuid:pk>/<str:action>", v.HolidayWorkActionView.as_view()),
    path("admin/holiday-work", v.AdminHolidayWorkView.as_view()),
    path("admin/holiday-work/rule", v.CompOffRuleView.as_view()),
    path("admin/holiday-work/<uuid:pk>/decision", v.AdminHolidayWorkDecisionView.as_view()),
]
