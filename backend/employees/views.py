from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsHRorSuperAdmin, IsSuperAdmin
from employees.models import Employee
from employees.permissions import EmployeePermission
from employees.serializers import (
    EmployeeBasicSerializer,
    EmployeeCreateSerializer,
    EmployeeSerializer,
    EmployeeUpdateSerializer,
)


class EmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [EmployeePermission]
    queryset = Employee.objects.select_related('reporting_manager', 'user').all()
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = Employee.objects.select_related('reporting_manager', 'user').all()

        if user.is_super_admin or user.is_hr_admin or user.is_finance:
            return queryset

        if user.is_manager:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                return Employee.objects.none()
            return queryset.filter(reporting_manager=manager_profile)

        if user.is_employee_user:
            return queryset.filter(user=user)

        return Employee.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return EmployeeCreateSerializer
        if self.action in ('update', 'partial_update'):
            return EmployeeUpdateSerializer
        if self.request.user.is_finance and self.action in ('list', 'retrieve', 'me'):
            return EmployeeBasicSerializer
        return EmployeeSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsSuperAdmin()]
        if self.action in ('create', 'update', 'partial_update'):
            return [IsHRorSuperAdmin()]
        return [EmployeePermission()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        response_data = EmployeeSerializer(employee).data
        response_data['temporary_password'] = getattr(employee, 'temporary_password', None)
        return Response(response_data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        employee = self.get_object()
        user = employee.user
        # Deleting the user also removes the employee (OneToOne CASCADE).
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def me(self, request):
        try:
            employee = (
                Employee.objects.select_related('reporting_manager', 'user')
                .get(user=request.user)
            )
        except Employee.DoesNotExist:
            return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer_class = (
            EmployeeBasicSerializer
            if request.user.is_finance
            else EmployeeSerializer
        )
        serializer = serializer_class(employee)
        return Response(serializer.data)
