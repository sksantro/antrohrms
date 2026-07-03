from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from policies.models import Policy, PolicyAcknowledgement
from policies.permissions import AcknowledgementPermission, PolicyPermission
from policies.serializers import (
    PolicyAcknowledgementSerializer,
    PolicyPendingSummarySerializer,
    PolicySerializer,
)
from policies.services import (
    acknowledge_policy,
    build_pending_summary,
    create_pending_acknowledgements_for_policy,
    get_employee_acknowledgement_status,
)


class PolicyViewSet(viewsets.ModelViewSet):
    queryset = Policy.objects.select_related('created_by').all()
    serializer_class = PolicySerializer
    permission_classes = [IsAuthenticated, PolicyPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        queryset = Policy.objects.select_related('created_by').all()

        if user.is_super_admin or user.is_hr_admin:
            return queryset

        if user.is_finance or user.is_manager:
            if self.action in ('list', 'retrieve', 'my_policies'):
                return queryset.filter(is_active=True)
            return queryset.none()

        if user.is_employee_user:
            if self.action in ('list', 'retrieve', 'my_policies', 'acknowledge'):
                return queryset.filter(is_active=True)
            return queryset.none()

        return queryset.none()

    def perform_create(self, serializer):
        policy = serializer.save(created_by=self.request.user)
        create_pending_acknowledgements_for_policy(policy)

    def perform_update(self, serializer):
        old_version = self.get_object().version
        policy = serializer.save()
        if policy.version != old_version and policy.is_active:
            create_pending_acknowledgements_for_policy(policy)
        elif policy.is_active and not PolicyAcknowledgement.objects.filter(
            policy=policy,
            policy_version=policy.version,
        ).exists():
            create_pending_acknowledgements_for_policy(policy)

    def destroy(self, request, *args, **kwargs):
        policy = self.get_object()
        policy.is_active = False
        policy.save(update_fields=['is_active', 'updated_at'])
        return Response(
            {'detail': 'Policy deactivated successfully.'},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], url_path='my')
    def my_policies(self, request):
        profile = getattr(request.user, 'employee_profile', None)
        if not profile:
            raise ValidationError({'detail': 'Employee profile not found.'})

        status_filter = request.query_params.get('status')
        policies = self.get_queryset().filter(is_active=True)

        results = []
        for policy in policies:
            ack_status = get_employee_acknowledgement_status(policy, profile)
            if status_filter and ack_status != status_filter:
                continue
            data = PolicySerializer(policy, context={'request': request}).data
            data['acknowledgement_status'] = ack_status
            results.append(data)

        return Response(results)

    @action(detail=True, methods=['post'], url_path='acknowledge')
    def acknowledge(self, request, pk=None):
        policy = self.get_object()
        profile = getattr(request.user, 'employee_profile', None)
        if not profile:
            raise ValidationError({'detail': 'Employee profile not found.'})

        try:
            acknowledgement = acknowledge_policy(policy, profile, request)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(PolicyAcknowledgementSerializer(acknowledgement).data)


class PolicyAcknowledgementListView(APIView):
    permission_classes = [IsAuthenticated, AcknowledgementPermission]

    def get(self, request):
        user = request.user
        queryset = PolicyAcknowledgement.objects.select_related(
            'policy',
            'employee',
        ).all()

        policy_id = request.query_params.get('policy')
        employee_id = request.query_params.get('employee')
        status_filter = request.query_params.get('status')
        current_version_only = request.query_params.get('current_version', 'true')

        if user.is_super_admin or user.is_hr_admin:
            pass
        elif user.is_manager:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                queryset = PolicyAcknowledgement.objects.none()
            else:
                queryset = queryset.filter(
                    employee__reporting_manager=manager_profile,
                )
        elif user.is_finance:
            profile = getattr(user, 'employee_profile', None)
            if profile:
                queryset = queryset.filter(employee=profile)
            else:
                queryset = PolicyAcknowledgement.objects.none()
        else:
            queryset = PolicyAcknowledgement.objects.none()

        if policy_id:
            queryset = queryset.filter(policy_id=policy_id)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if current_version_only == 'true':
            queryset = queryset.filter(policy__version=F('policy_version'))

        serializer = PolicyAcknowledgementSerializer(queryset, many=True)
        return Response(serializer.data)


class PolicyPendingSummaryView(APIView):
    permission_classes = [IsAuthenticated, PolicyPermission]

    def get(self, request):
        if not (request.user.is_super_admin or request.user.is_hr_admin):
            return Response({'detail': 'Not permitted.'}, status=status.HTTP_403_FORBIDDEN)

        data = build_pending_summary()
        serializer = PolicyPendingSummarySerializer(data)
        return Response(serializer.data)
