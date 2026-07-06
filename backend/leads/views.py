from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from employees.models import Employee
from leads.models import Lead, LeadActivity, LeadContact, LeadStatusChange
from leads.permissions import LeadPermission, user_can_manage_lead
from leads.serializers import (
    LeadActivityCreateSerializer,
    LeadActivitySerializer,
    LeadActivityUpdateSerializer,
    LeadChangeStatusSerializer,
    LeadContactCreateUpdateSerializer,
    LeadContactSerializer,
    LeadCreateSerializer,
    LeadDashboardSerializer,
    LeadDetailSerializer,
    LeadEditSerializer,
    LeadSerializer,
)
from leads.services import build_dashboard_stats, filter_leads_queryset, get_recent_leads, touch_lead_last_activity


class LeadViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [LeadPermission]
    pagination_class = None

    def get_base_queryset(self):
        queryset = Lead.objects.select_related(
            'created_by',
            'lead_owner',
            'last_updated_by',
        ).annotate(
            contact_count_value=Count('contacts', distinct=True),
        )
        user = self.request.user
        if user.is_super_admin:
            return queryset
        return queryset.filter(lead_owner=user)

    def get_queryset(self):
        queryset = self.get_base_queryset()
        if self.action == 'retrieve':
            activity_qs = LeadActivity.objects.select_related('created_by', 'assigned_to', 'edited_by', 'deleted_by')
            if not self.request.user.is_super_admin:
                activity_qs = activity_qs.filter(is_deleted=False)
            return queryset.prefetch_related(
                Prefetch('contacts', queryset=LeadContact.objects.all()),
                Prefetch('activities', queryset=activity_qs),
                Prefetch('status_changes', queryset=LeadStatusChange.objects.select_related('changed_by')),
            )
        return filter_leads_queryset(queryset, self.request.query_params)

    def get_serializer_class(self):
        if self.action == 'create':
            return LeadCreateSerializer
        if self.action in ('update', 'partial_update'):
            return LeadEditSerializer
        if self.action == 'retrieve':
            return LeadDetailSerializer
        if self.action == 'dashboard':
            return LeadDashboardSerializer
        if self.action == 'change_status':
            return LeadChangeStatusSerializer
        return LeadSerializer

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        queryset = self.get_base_queryset()
        payload = {
            'stats': build_dashboard_stats(queryset),
            'recent_leads': get_recent_leads(queryset),
        }
        serializer = LeadDashboardSerializer(payload)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadChangeStatusSerializer(data=request.data, context={'lead': lead})
        serializer.is_valid(raise_exception=True)

        previous_status = lead.current_status
        new_status = serializer.validated_data['new_status']
        remarks = serializer.validated_data.get('remarks', '')
        is_countable = serializer.validated_data['is_countable_for_kpi']

        lead.current_status = new_status
        if remarks:
            lead.remarks = remarks
        lead.last_updated_by = request.user
        lead.save(update_fields=['current_status', 'remarks', 'last_updated_by', 'updated_at'])
        touch_lead_last_activity(lead, request.user)

        if previous_status != new_status or remarks:
            LeadStatusChange.objects.create(
                lead=lead,
                previous_status=previous_status,
                new_status=new_status,
                remarks=remarks,
                changed_by=request.user,
                is_countable_for_kpi=is_countable,
            )
            if not is_countable:
                from leads.risk_events import record_same_status_event

                record_same_status_event(request.user, lead)

        return Response(LeadDetailSerializer(lead, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='activity-assignees')
    def activity_assignees(self, request):
        from accounts.models import User

        queryset = User.objects.filter(is_active=True).filter(
            Q(role=User.Role.SUPER_ADMIN)
            | Q(employee_profile__department=Employee.Department.SALES_MARKETING),
        ).distinct().order_by('full_name')
        data = [{'id': user.id, 'full_name': user.full_name} for user in queryset]
        return Response(data)


class LeadContactViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [LeadPermission]
    pagination_class = None

    def get_lead(self):
        lead = get_object_or_404(Lead, pk=self.kwargs['lead_pk'])
        if not user_can_manage_lead(self.request.user, lead):
            self.permission_denied(self.request, message='You do not have permission to access this lead.')
        return lead

    def get_queryset(self):
        lead = self.get_lead()
        return LeadContact.objects.filter(lead=lead)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return LeadContactCreateUpdateSerializer
        return LeadContactSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.kwargs.get('lead_pk'):
            context['lead'] = get_object_or_404(Lead, pk=self.kwargs['lead_pk'])
        return context

    def perform_create(self, serializer):
        lead = self.get_lead()
        serializer.save(lead=lead)
        touch_lead_last_activity(lead, self.request.user)

    def destroy(self, request, *args, **kwargs):
        contact = self.get_object()
        contact.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LeadActivityViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [LeadPermission]
    pagination_class = None

    def get_lead(self):
        lead = get_object_or_404(Lead, pk=self.kwargs['lead_pk'])
        if not user_can_manage_lead(self.request.user, lead):
            self.permission_denied(self.request, message='You do not have permission to access this lead.')
        return lead

    def get_queryset(self):
        lead = self.get_lead()
        queryset = LeadActivity.objects.filter(lead=lead).select_related(
            'created_by',
            'assigned_to',
            'edited_by',
            'deleted_by',
        )
        if not self.request.user.is_super_admin:
            queryset = queryset.filter(is_deleted=False)
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return LeadActivityCreateSerializer
        if self.action in ('update', 'partial_update'):
            return LeadActivityUpdateSerializer
        return LeadActivitySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.kwargs.get('lead_pk'):
            context['lead'] = get_object_or_404(Lead, pk=self.kwargs['lead_pk'])
        return context

    def perform_create(self, serializer):
        lead = self.get_lead()
        serializer.save(lead=lead)

    def destroy(self, request, *args, **kwargs):
        from django.utils import timezone

        from leads.risk_events import record_activity_deleted_event

        activity = self.get_object()
        if activity.is_deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)

        activity.is_deleted = True
        activity.deleted_at = timezone.now()
        activity.deleted_by = request.user
        activity.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])
        record_activity_deleted_event(request.user, activity.lead, activity)
        return Response(status=status.HTTP_204_NO_CONTENT)
