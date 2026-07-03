from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from attendance.models import Attendance
from attendance.permissions import AttendancePermission, CanManageAttendance
from attendance.serializers import (
    AttendanceCreateUpdateSerializer,
    AttendanceSerializer,
    AttendanceSummarySerializer,
    CheckInSerializer,
    CheckOutSerializer,
)
from attendance.services import (
    calculate_late_minutes,
    calculate_total_work_hours,
    get_company_start_time,
    get_today,
    resolve_status,
)
from employees.models import Employee


class AttendanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, AttendancePermission]
    queryset = Attendance.objects.select_related('employee').all()
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.action in ('create', 'partial_update'):
            return AttendanceCreateUpdateSerializer
        if self.action == 'check_in':
            return CheckInSerializer
        if self.action == 'check_out':
            return CheckOutSerializer
        if self.action == 'summary':
            return AttendanceSummarySerializer
        return AttendanceSerializer

    def get_permissions(self):
        if self.action in ('create', 'partial_update'):
            return [IsAuthenticated(), CanManageAttendance()]
        return [IsAuthenticated(), AttendancePermission()]

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.select_related('employee').all()

        employee_id = self.request.query_params.get('employee')
        department = self.request.query_params.get('department')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        status_filter = self.request.query_params.get('status')

        if user.is_super_admin or user.is_hr_admin or user.is_finance:
            pass
        elif user.is_manager:
            manager_profile = getattr(user, 'employee_profile', None)
            if not manager_profile:
                return Attendance.objects.none()
            queryset = queryset.filter(employee__reporting_manager=manager_profile)
        elif user.is_employee_user:
            profile = getattr(user, 'employee_profile', None)
            if not profile:
                return Attendance.objects.none()
            queryset = queryset.filter(employee=profile)
        else:
            return Attendance.objects.none()

        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if department:
            queryset = queryset.filter(employee__department__iexact=department)
        if month:
            queryset = queryset.filter(date__month=month)
        if year:
            queryset = queryset.filter(date__year=year)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def _get_employee_profile(self, user):
        profile = getattr(user, 'employee_profile', None)
        if not profile:
            raise ValidationError({'detail': 'Employee profile not found for this user.'})
        return profile

    def _get_today_attendance(self, employee):
        return Attendance.objects.filter(employee=employee, date=get_today()).first()

    @action(detail=False, methods=['post'], url_path='check-in')
    def check_in(self, request):
        if not (request.user.is_employee_user or request.user.is_manager):
            return Response({'detail': 'Only employees can check in.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        employee = self._get_employee_profile(request.user)
        today = get_today()

        if Attendance.objects.filter(employee=employee, date=today).exists():
            return Response(
                {'detail': 'You have already checked in today.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now_time = timezone.localtime().time()
        company_start = get_company_start_time()
        late_minutes = calculate_late_minutes(now_time, company_start)
        attendance_status = resolve_status(late_minutes, True, False)

        attendance = Attendance.objects.create(
            employee=employee,
            date=today,
            check_in_time=now_time,
            work_mode=serializer.validated_data['work_mode'],
            status=attendance_status,
            late_minutes=late_minutes,
        )
        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='check-out')
    def check_out(self, request):
        if not (request.user.is_employee_user or request.user.is_manager):
            return Response({'detail': 'Only employees can check out.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CheckOutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        employee = self._get_employee_profile(request.user)
        attendance = self._get_today_attendance(employee)

        if not attendance or not attendance.check_in_time:
            return Response(
                {'detail': 'Check-in is required before check-out.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if attendance.check_out_time:
            return Response(
                {'detail': 'You have already checked out today.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now_time = timezone.localtime().time()
        attendance.check_out_time = now_time
        attendance.total_work_hours = calculate_total_work_hours(
            attendance.check_in_time,
            now_time,
        )
        if serializer.validated_data.get('remarks'):
            attendance.remarks = serializer.validated_data['remarks']

        if attendance.status not in {
            Attendance.Status.HALF_DAY,
            Attendance.Status.ON_LEAVE,
            Attendance.Status.HOLIDAY,
        }:
            attendance.status = resolve_status(
                attendance.late_minutes,
                True,
                True,
                attendance.total_work_hours,
            )

        attendance.save()
        return Response(AttendanceSerializer(attendance).data)

    @action(detail=False, methods=['get'], url_path='my')
    def my(self, request):
        profile = self._get_employee_profile(request.user)
        queryset = Attendance.objects.filter(employee=profile).select_related('employee')

        month = request.query_params.get('month')
        year = request.query_params.get('year')
        if month:
            queryset = queryset.filter(date__month=month)
        if year:
            queryset = queryset.filter(date__year=year)

        serializer = AttendanceSerializer(queryset, many=True)
        today_record = self._get_today_attendance(profile)
        return Response({
            'today': AttendanceSerializer(today_record).data if today_record else None,
            'records': serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        user = request.user
        if user.role not in {User.Role.SUPER_ADMIN, User.Role.HR_ADMIN, User.Role.FINANCE}:
            return Response({'detail': 'Not permitted.'}, status=status.HTTP_403_FORBIDDEN)

        queryset = self.get_queryset()

        data = {
            'total_records': queryset.count(),
            'present': queryset.filter(status=Attendance.Status.PRESENT).count(),
            'absent': queryset.filter(status=Attendance.Status.ABSENT).count(),
            'late': queryset.filter(status=Attendance.Status.LATE).count(),
            'half_day': queryset.filter(status=Attendance.Status.HALF_DAY).count(),
            'on_leave': queryset.filter(status=Attendance.Status.ON_LEAVE).count(),
            'holiday': queryset.filter(status=Attendance.Status.HOLIDAY).count(),
            'total_work_hours': queryset.aggregate(total=Sum('total_work_hours'))['total'] or 0,
            'total_late_minutes': queryset.aggregate(total=Sum('late_minutes'))['total'] or 0,
        }
        serializer = AttendanceSummarySerializer(data)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)
