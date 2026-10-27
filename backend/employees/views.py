from django.db.models import Q
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, RoleAssignment
from accounts.permissions import IsSuperAdmin
from common.errors import BusinessRuleError
from common.services import audit

from .models import Department, Employee
from .serializers import EDITABLE, DepartmentSerializer, EmployeeCreateSerializer, EmployeeSelfSerializer, EmployeeSerializer, EmployeeUpdateSerializer
from .services import create_employee, send_invite


def _snapshot(emp: Employee, fields) -> dict:
    out = {}
    for f in fields:
        v = getattr(emp, f)
        out[f] = str(v) if v is not None and not isinstance(v, (str, int, dict, list, bool)) else v
    return out


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DepartmentSerializer
    pagination_class = None

    def get_queryset(self):
        return Department.objects.filter(organization=self.request.user.organization)


class EmployeeViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Directory: Super Admin and HR see everyone (operational fields only); everyone else sees only themself."""

    def _is_staff(self) -> bool:
        return self.request.user.has_role(Role.SUPER_ADMIN, Role.HR_OPERATIONS)

    def get_queryset(self):
        u = self.request.user
        qs = Employee.objects.filter(organization=u.organization).select_related("department", "reporting_manager", "user").prefetch_related("user__role_assignments")
        if not self._is_staff():
            qs = qs.filter(user=u)  # object scope: others are 404, never leaked
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(display_name__icontains=q) | Q(employee_code__icontains=q) | Q(designation__icontains=q))
        if dept := self.request.query_params.get("department"):
            qs = qs.filter(department_id=dept)
        if status := self.request.query_params.get("status"):
            qs = qs.filter(status=status)
        elif self.action == "list" and self.request.query_params.get("former") != "1":
            qs = qs.exclude(status=Employee.Status.EXITED)  # former employees are listed only on request
        if self.action == "list" and self.request.query_params.get("former") == "1":
            qs = qs.filter(status=Employee.Status.EXITED)
        return qs

    def serializer_for(self, emp: Employee):
        u = self.request.user
        return EmployeeSelfSerializer if u.has_role(Role.SUPER_ADMIN) or emp.user_id == u.id else EmployeeSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return EmployeeCreateSerializer
        return EmployeeSelfSerializer if self.request.user.has_role(Role.SUPER_ADMIN) else EmployeeSerializer

    def retrieve(self, request, *args, **kwargs):
        emp = self.get_object()
        return Response(self.serializer_for(emp)(emp).data)

    def list(self, request, *args, **kwargs):
        if not self._is_staff():
            raise PermissionDenied()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not self._is_staff():
            raise PermissionDenied()
        s = EmployeeCreateSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        roles = data.pop("roles")
        if not request.user.has_role(Role.SUPER_ADMIN) and set(roles) - {Role.EMPLOYEE}:
            raise PermissionDenied("Only the Super Admin can grant roles.")
        emp, link = create_employee(actor=request.user, data=data, roles=roles, request=request)
        emp = self.get_queryset().get(pk=emp.pk)
        return Response({**EmployeeSerializer(emp).data, "invite_url": link}, status=201)

    def partial_update(self, request, pk=None):
        emp = self.get_object()
        u = request.user
        if u.has_role(Role.SUPER_ADMIN):
            allowed = EDITABLE[Role.SUPER_ADMIN]
        elif u.has_role(Role.HR_OPERATIONS) and emp.user_id != u.id:
            allowed = EDITABLE[Role.HR_OPERATIONS]
        elif emp.user_id == u.id:
            allowed = EDITABLE["SELF"]  # HR editing their own record gets no extra rights (no self-approval)
        else:
            raise PermissionDenied()
        s = EmployeeUpdateSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        blocked = set(s.validated_data) - allowed
        if blocked:
            raise PermissionDenied(f"You can't change: {', '.join(sorted(blocked))}.")
        data = s.validated_data
        if "department_id" in data and not Department.objects.filter(pk=data["department_id"], organization=u.organization).exists():
            raise serializers.ValidationError({"department_id": ["Unknown department."]})
        if data.get("reporting_manager_id") == emp.pk:
            raise serializers.ValidationError({"reporting_manager_id": ["An employee can't report to themself."]})
        before = _snapshot(emp, data.keys())
        for k, v in data.items():
            setattr(emp, k, v)
        emp.save()
        audit(actor=u, action="EMPLOYEE_UPDATED", entity=emp, before=before, after=_snapshot(emp, data.keys()), request=request)
        emp = self.get_queryset().get(pk=emp.pk)
        return Response(self.serializer_for(emp)(emp).data)

    @action(detail=False, methods=["get"])
    def me(self, request):
        emp = self.get_queryset().filter(user=request.user).first()
        if emp is None:
            raise BusinessRuleError("NO_EMPLOYEE_PROFILE", "Your account has no employee profile yet.")
        return Response(EmployeeSelfSerializer(emp).data)

    @action(detail=True, methods=["post"], url_path="resend-invite")
    def resend_invite(self, request, pk=None):
        if not self._is_staff():
            raise PermissionDenied()
        emp = self.get_object()
        if emp.user.has_usable_password():
            raise BusinessRuleError("ALREADY_ACTIVATED", "This employee has already activated their account.")
        invite, link = send_invite(user=emp.user, actor=request.user, request=request)
        return Response({"invite_url": link, "expires_at": invite.expires_at})


class RoleSerializer(serializers.Serializer):
    roles = serializers.ListField(child=serializers.ChoiceField(choices=Role.choices))


class EmployeeRolesView(APIView):
    """Only Super Admin can change roles; HR cannot change permissions (BRD §1.1)."""

    permission_classes = [IsSuperAdmin]

    def put(self, request, pk):
        emp = Employee.objects.filter(organization=request.user.organization, pk=pk).select_related("user").first()
        if emp is None:
            raise BusinessRuleError("NOT_FOUND", "Employee not found.")
        s = RoleSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        new = set(s.validated_data["roles"]) | {Role.EMPLOYEE}
        if emp.user_id == request.user.id and Role.SUPER_ADMIN not in new:
            raise BusinessRuleError("SELF_LOCKOUT", "You can't remove your own Super Admin role.")
        old = set(emp.user.role_set)
        RoleAssignment.objects.filter(user=emp.user).exclude(role__in=new).delete()
        for r in new - old:
            RoleAssignment.objects.create(user=emp.user, role=r, granted_by=request.user)
        audit(actor=request.user, action="ROLES_CHANGED", entity=emp.user, before={"roles": sorted(old)}, after={"roles": sorted(new)}, request=request)
        return Response({"roles": sorted(new)})


class EmployeeImportView(APIView):
    """POST an .xlsx with commit=false for a preview (no writes), commit=true to import. Super Admin only."""

    permission_classes = [IsSuperAdmin]
    parser_classes = [MultiPartParser]
    MAX_BYTES = 5 * 1024 * 1024

    def post(self, request):
        from . import importer

        f = request.FILES.get("file")
        if f is None:
            raise BusinessRuleError("FILE_REQUIRED", "Choose an Excel (.xlsx) file to upload.")
        if not f.name.lower().endswith(".xlsx") or f.size > self.MAX_BYTES:
            raise BusinessRuleError("INVALID_FILE", "Upload an .xlsx file up to 5 MB.")
        data = f.read()
        try:
            if request.data.get("commit") in ("true", "1", True):
                return Response(importer.commit(data, actor=request.user, request=request), status=201)
            result = importer.parse(data, request.user.organization)
        except ValueError as e:
            raise BusinessRuleError("INVALID_SHEET", str(e)) from e
        return Response({**{k: v for k, v in result.items() if k != "rows"}, "rows": [r.as_dict() for r in result["rows"]]})
