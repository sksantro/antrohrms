from django.urls import path

from . import views as v

urlpatterns = [
    path("hr/assets", v.AssetsView.as_view()),
    path("hr/assets/<uuid:pk>/assign", v.AssetAssignView.as_view()),
    path("hr/allocations/<uuid:pk>/<str:action>", v.AllocationHRView.as_view()),
    path("assets/me", v.MyAssetsView.as_view()),
    path("allocations/<uuid:pk>/<str:action>", v.MyAllocationView.as_view()),
    path("admin/allocations/disputes", v.DisputesView.as_view()),
    path("admin/allocations/<uuid:pk>/resolve", v.AllocationResolveView.as_view()),
    path("admin/assets/<uuid:pk>/state", v.AssetStateView.as_view()),
    path("resignation/me", v.MyResignationView.as_view()),
    path("resignation/preview", v.ResignationPreviewView.as_view()),
    path("resignation/<uuid:pk>/<str:action>", v.MyResignationActionView.as_view()),
    path("resignations/<uuid:pk>/letter", v.OwnLetterView.as_view()),
    path("hr/exits", v.ExitsView.as_view()),
    path("hr/exits/<uuid:pk>/checklist", v.ExitChecklistView.as_view()),
    path("hr/exits/<uuid:pk>/complete", v.ExitCompleteView.as_view()),
    path("admin/resignations/<uuid:pk>/decision", v.ResignationDecisionView.as_view()),
    path("admin/exits/<uuid:pk>/settlement", v.SettlementView.as_view()),
    path("admin/exits/<uuid:pk>/settlement/approve", v.SettlementApproveView.as_view()),
]
