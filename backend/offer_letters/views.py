from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from offer_letters.models import OfferLetter
from offer_letters.permissions import OfferLetterPermission
from offer_letters.serializers import (
    OfferLetterCreateUpdateSerializer,
    OfferLetterPublicSerializer,
    OfferLetterSendResponseSerializer,
    OfferLetterSerializer,
)
from offer_letters.services import (
    accept_offer_letter,
    cancel_offer_letter,
    mark_offer_expired_if_needed,
    reject_offer_letter,
    send_offer_letter,
)


class OfferLetterViewSet(viewsets.ModelViewSet):
    permission_classes = [OfferLetterPermission]
    queryset = OfferLetter.objects.select_related('reporting_manager', 'created_by').all()
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return OfferLetterCreateUpdateSerializer
        return OfferLetterSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        department = self.request.query_params.get('department')
        designation = self.request.query_params.get('designation')
        created_from = self.request.query_params.get('created_from')
        created_to = self.request.query_params.get('created_to')
        search = self.request.query_params.get('search', '').strip()

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if department:
            queryset = queryset.filter(department=department)
        if designation:
            queryset = queryset.filter(designation__iexact=designation)
        if created_from:
            queryset = queryset.filter(created_at__date__gte=created_from)
        if created_to:
            queryset = queryset.filter(created_at__date__lte=created_to)
        if search:
            queryset = queryset.filter(
                models.Q(candidate_name__icontains=search)
                | models.Q(email__icontains=search)
                | models.Q(offer_id__icontains=search)
            )
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        for offer in queryset:
            mark_offer_expired_if_needed(offer)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        offer = self.get_object()
        mark_offer_expired_if_needed(offer)
        serializer = self.get_serializer(offer)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, status=OfferLetter.Status.DRAFT)

    def destroy(self, request, *args, **kwargs):
        offer = self.get_object()
        if offer.status != OfferLetter.Status.DRAFT:
            return Response(
                {'detail': 'Only draft offers can be deleted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        offer = self.get_object()
        try:
            result = send_offer_letter(offer)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        serializer = OfferLetterSendResponseSerializer(result)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        offer = self.get_object()
        try:
            cancel_offer_letter(offer)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OfferLetterSerializer(offer).data)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        offer = self.get_object()
        mark_offer_expired_if_needed(offer)
        return Response(OfferLetterSerializer(offer).data)


class PublicOfferLetterView(APIView):
    authentication_classes = []
    permission_classes = []

    def get_offer(self, token):
        return get_object_or_404(OfferLetter, acceptance_token=token)

    def get(self, request, token):
        offer = self.get_offer(token)
        mark_offer_expired_if_needed(offer)
        return Response(OfferLetterPublicSerializer(offer).data)

    def post(self, request, token):
        action_name = request.data.get('action')
        offer = self.get_offer(token)
        mark_offer_expired_if_needed(offer)

        try:
            if action_name == 'accept':
                accept_offer_letter(offer)
            elif action_name == 'reject':
                reject_offer_letter(offer)
            else:
                return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OfferLetterPublicSerializer(offer).data)
