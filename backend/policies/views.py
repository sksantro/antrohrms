from django.db.models import F, Q
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
    is_policy_assigned_to_employee,
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
            profile = getattr(user, 'employee_profile', None)
            if self.action in ('list', 'retrieve', 'my_policies', 'acknowledge') and profile:
                return queryset.filter(status=Policy.Status.PUBLISHED).distinct()
            return queryset.none()
        return queryset.none()

    def filter_queryset_for_list(self, queryset):
        params = self.request.query_params
        search = params.get('search', '').strip()
        category = params.get('category', '').strip()
        status_filter = params.get('status', '').strip()
        applies_to = params.get('applies_to', '').strip()
        requires_ack = params.get('requires_acknowledgement', '').strip().lower()

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(category__icontains=search)
                | Q(description__icontains=search)
            )
        if category:
            queryset = queryset.filter(category=category)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if applies_to:
            queryset = queryset.filter(applies_to=applies_to)
        if requires_ack in ('true', 'false'):
            queryset = queryset.filter(requires_acknowledgement=(requires_ack == 'true'))
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset_for_list(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        policy = serializer.save(created_by=self.request.user)
        if policy.status == Policy.Status.PUBLISHED:
            create_pending_acknowledgements_for_policy(policy)

    def perform_update(self, serializer):
        existing = self.get_object()
        old_version = existing.version
        old_status = existing.status
        old_requires_ack = existing.requires_acknowledgement
        material_fields = (
            'title',
            'category',
            'description',
            'policy_content',
            'effective_date',
            'applies_to',
            'applies_to_departments',
            'applies_to_designations',
            'applies_to_employees',
            'requires_acknowledgement',
        )
        has_material_change = any(
            field in serializer.validated_data
            and serializer.validated_data[field] != getattr(existing, field)
            for field in material_fields
        ) or ('policy_file' in serializer.validated_data and serializer.validated_data['policy_file'])

        if (
            old_status == Policy.Status.PUBLISHED
            and has_material_change
            and serializer.validated_data.get('version', old_version) == old_version
        ):
            raise ValidationError(
                {'version': 'Increment version when editing a published policy.'}
            )

        policy = serializer.save()
        if policy.status == Policy.Status.PUBLISHED and policy.requires_acknowledgement and (
            policy.version != old_version
            or old_status != Policy.Status.PUBLISHED
            or old_requires_ack != policy.requires_acknowledgement
        ):
            create_pending_acknowledgements_for_policy(policy)
        elif (
            policy.status == Policy.Status.PUBLISHED
            and policy.requires_acknowledgement
            and not PolicyAcknowledgement.objects.filter(
                policy=policy,
                policy_version=policy.version,
            ).exists()
        ):
            create_pending_acknowledgements_for_policy(policy)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Deleting policies is not supported. Archive instead.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        policy = self.get_object()
        policy.status = Policy.Status.PUBLISHED
        policy.save(update_fields=['status', 'is_active', 'updated_at'])
        if policy.requires_acknowledgement:
            create_pending_acknowledgements_for_policy(policy)
        serializer = self.get_serializer(policy)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='unpublish')
    def unpublish(self, request, pk=None):
        policy = self.get_object()
        policy.status = Policy.Status.UNPUBLISHED
        policy.save(update_fields=['status', 'is_active', 'updated_at'])
        return Response(self.get_serializer(policy).data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        policy = self.get_object()
        policy.status = Policy.Status.ARCHIVED
        policy.save(update_fields=['status', 'is_active', 'updated_at'])
        return Response(self.get_serializer(policy).data)

    @action(detail=False, methods=['get'], url_path='my')
    def my_policies(self, request):
        profile = getattr(request.user, 'employee_profile', None)
        if not profile:
            raise ValidationError({'detail': 'Employee profile not found.'})

        status_filter = request.query_params.get('status')
        policies = self.get_queryset().filter(status=Policy.Status.PUBLISHED)

        results = []
        for policy in policies:
            if not is_policy_assigned_to_employee(policy, profile):
                continue
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
        if request.data.get('confirmed') is not True:
            return Response(
                {'detail': 'Please confirm policy acknowledgement before submitting.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        confirmation_text = (
            request.data.get('confirmation_text')
            or 'I have read and understood this company policy.'
        )

        try:
            acknowledgement = acknowledge_policy(
                policy,
                profile,
                request,
                confirmation_text=confirmation_text,
            )
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
        department = request.query_params.get('department')
        designation = request.query_params.get('designation')
        search = request.query_params.get('search')
        acknowledged_from = request.query_params.get('acknowledged_from')
        acknowledged_to = request.query_params.get('acknowledged_to')
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
        if department:
            queryset = queryset.filter(employee__department=department)
        if designation:
            queryset = queryset.filter(employee__designation=designation)
        if search:
            queryset = queryset.filter(
                Q(policy__title__icontains=search)
                | Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
                | Q(employee__email__icontains=search)
                | Q(employee__department__icontains=search)
            )
        if acknowledged_from:
            queryset = queryset.filter(acknowledged_at__date__gte=acknowledged_from)
        if acknowledged_to:
            queryset = queryset.filter(acknowledged_at__date__lte=acknowledged_to)
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
