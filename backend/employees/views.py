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

from .access import AUTO_ROLES, MATRIX, ROLES, auto_roles, sync_designation
from .models import Department, DesignationRole, Employee
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
        if not emp.user.is_active or emp.status == Employee.Status.EXITED:
            raise BusinessRuleError("ACCOUNT_INACTIVE", "This person is a former employee, so they can't sign in.")
        if emp.user.has_role(Role.SUPER_ADMIN) and not request.user.has_role(Role.SUPER_ADMIN):
            raise PermissionDenied("Only a Super Admin can reset a Super Admin's password.")
        # Not activated yet → invite; already activated → password reset. Both use the same single-use link.
        kind = "reset" if emp.user.has_usable_password() else "invite"
        invite, link = send_invite(user=emp.user, actor=request.user, request=request)
        return Response({"invite_url": link, "expires_at": invite.expires_at, "kind": kind})


class RoleSerializer(serializers.Serializer):
    roles = serializers.ListField(child=serializers.ChoiceField(choices=[(r, Role(r).label) for r in ROLES]))


class EmployeeRolesView(APIView):
    """Only Super Admin can change roles; HR cannot change permissions (BRD §1.1)."""

    permission_classes = [IsSuperAdmin]

    def put(self, request, pk):
        emp = Employee.objects.filter(organization=request.user.organization, pk=pk).select_related("user").first()
        if emp is None:
            raise BusinessRuleError("NOT_FOUND", "Employee not found.")
        s = RoleSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        auto = auto_roles(emp)  # designation / reporting-line roles stay while their reason holds
        new = set(s.validated_data["roles"]) | {Role.EMPLOYEE} | set(auto)
        if emp.user_id == request.user.id and Role.SUPER_ADMIN not in new:
            raise BusinessRuleError("SELF_LOCKOUT", "You can't remove your own Super Admin role.")
        old = set(emp.user.role_set)
        # Roles outside today's four (e.g. Interviewer) are left as they are.
        RoleAssignment.objects.filter(user=emp.user, role__in=ROLES).exclude(role__in=new).delete()
        for r in new - old:
            RoleAssignment.objects.create(user=emp.user, role=r, granted_by=request.user, source=auto.get(r, "MANUAL"))
        new = set(RoleAssignment.objects.filter(user=emp.user).values_list("role", flat=True))
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


class AccessView(APIView):
    """Access Management (Super Admin): the four roles, who holds them and why, and designation rules."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        org = request.user.organization
        people = Employee.objects.filter(organization=org).exclude(status__in=["EXITED", "INACTIVE"]).select_related("user").prefetch_related("user__role_assignments")
        rows = [{"id": str(e.pk), "display_name": e.display_name, "designation": e.designation, "employee_code": e.employee_code,
                 "roles": [{"role": ra.role, "source": ra.source} for ra in e.user.role_assignments.all() if ra.role in ROLES]} for e in people]
        designations = sorted({e.designation.strip() for e in people if e.designation.strip()}, key=str.lower)
        rules = {r.designation.lower(): r.roles for r in DesignationRole.objects.filter(organization=org)}
        return Response({
            "roles": [{"role": r, "name": {"HR_OPERATIONS": "HR", "REPORTING_MANAGER": "Reporting Manager (RM)"}.get(r, Role(r).label)} for r in ROLES],
            "matrix": [{"capability": c, "access": dict(zip(ROLES, a))} for c, a in MATRIX],
            "people": rows,
            "designations": [{"designation": d, "roles": rules.get(d.lower(), []), "people": sum(1 for e in people if e.designation.strip().lower() == d.lower())} for d in designations],
        })


class DesignationRuleIn(serializers.Serializer):
    designation = serializers.CharField(max_length=120)
    roles = serializers.ListField(child=serializers.ChoiceField(choices=sorted(AUTO_ROLES)))


class DesignationRuleView(APIView):
    permission_classes = [IsSuperAdmin]

    def put(self, request):
        s = DesignationRuleIn(data=request.data)
        s.is_valid(raise_exception=True)
        org, d, roles = request.user.organization, s.validated_data["designation"].strip(), sorted(set(s.validated_data["roles"]))
        rule = DesignationRole.objects.filter(organization=org, designation__iexact=d).first()
        before = rule.roles if rule else []
        if roles:
            rule = rule or DesignationRole(organization=org, designation=d)
            rule.roles, rule.updated_by = roles, request.user
            rule.save()
        elif rule:
            rule.delete()
        n = sync_designation(org, d)
        audit(actor=request.user, action="DESIGNATION_ROLES_CHANGED", entity=request.user, before={"designation": d, "roles": before},
              after={"designation": d, "roles": roles, "people_updated": n}, request=request, organization=org)
        return Response({"designation": d, "roles": roles, "people_updated": n})


class DirectoryView(APIView):
    """Colleague directory for every signed-in employee: work details only (no phone, address, salary or status)."""

    def get(self, request):
        people = (Employee.objects.filter(organization=request.user.organization).exclude(status__in=["EXITED", "INACTIVE", "PREBOARDING"])
                  .select_related("department").order_by("display_name"))
        return Response({"people": [{"id": str(e.pk), "display_name": e.display_name, "designation": e.designation, "department": e.department.name,
                                     "email": e.official_email, "manager_id": str(e.reporting_manager_id) if e.reporting_manager_id else None,
                                     "joined": e.start_date} for e in people]})
