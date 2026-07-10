from rest_framework.permissions import BasePermission


class OfferLetterPermission(BasePermission):
    message = 'You do not have permission to manage offer letters.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.is_super_admin or user.is_hr_admin

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)
