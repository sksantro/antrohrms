"""Role checks. Every endpoint checks role AND object scope on the server (BRD §1.1 Least privilege)."""
from rest_framework.permissions import BasePermission

from .models import Role


def has_role(*roles: str) -> type[BasePermission]:
    class _HasRole(BasePermission):
        message = "You don't have access to this."

        def has_permission(self, request, view):
            u = request.user
            return bool(u and u.is_authenticated and u.is_active and u.has_role(*roles))

    _HasRole.__name__ = "HasRole_" + "_".join(roles)
    return _HasRole


IsSuperAdmin = has_role(Role.SUPER_ADMIN)
IsSuperAdminOrHR = has_role(Role.SUPER_ADMIN, Role.HR_OPERATIONS)
