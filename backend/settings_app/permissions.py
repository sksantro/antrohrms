from rest_framework.permissions import BasePermission, SAFE_METHODS


class CompanySettingsPermission(BasePermission):
    message = 'You do not have permission to manage company settings.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.is_super_admin


class CompanyHolidayPermission(BasePermission):
    message = 'You do not have permission to manage holidays.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.is_super_admin or user.is_hr_admin

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_super_admin or request.user.is_hr_admin


class HRMasterDataPermission(BasePermission):
    """HR and Super Admin can manage HR master data (departments, designations, etc.)."""

    message = 'You do not have permission to manage HR master data.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.is_super_admin or user.is_hr_admin

    def has_object_permission(self, request, view, obj):
        return request.user.is_super_admin or request.user.is_hr_admin
