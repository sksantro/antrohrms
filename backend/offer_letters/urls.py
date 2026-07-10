from django.urls import include, path
from rest_framework.routers import DefaultRouter

from offer_letters import views

app_name = 'offer_letters'

router = DefaultRouter()
router.register('', views.OfferLetterViewSet, basename='offer-letter')

urlpatterns = [
    path('public/<uuid:token>/', views.PublicOfferLetterView.as_view(), name='public-offer-letter'),
    path('', include(router.urls)),
]
