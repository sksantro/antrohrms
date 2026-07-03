from django.urls import path

from accounts import views

app_name = 'accounts'

urlpatterns = [
    path('users/', views.UserListCreateView.as_view(), name='user-list-create'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('me/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
]
