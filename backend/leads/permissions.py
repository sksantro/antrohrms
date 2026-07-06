from django.core.exceptions import ObjectDoesNotExist
from rest_framework.permissions import BasePermission

from employees.models import Employee
from leads.models import Lead, LeadActivity, LeadContact


def user_can_access_leads(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_super_admin:
        return True
    if not user.is_employee_user:
        return False
    try:
        return user.employee_profile.department == Employee.Department.SALES_MARKETING
    except ObjectDoesNotExist:
        return False


def user_can_manage_lead(user, lead: Lead) -> bool:
    if not user_can_access_leads(user):
        return False
    if user.is_super_admin:
        return True
    return lead.lead_owner_id == user.id


def user_can_manage_contact(user, contact: LeadContact) -> bool:
    return user_can_manage_lead(user, contact.lead)


class LeadPermission(BasePermission):
    message = 'Only Super Admin and Sales & Marketing users can access leads.'

    def has_permission(self, request, view):
        return user_can_access_leads(request.user)

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Lead):
            return user_can_manage_lead(request.user, obj)
        if isinstance(obj, LeadContact):
            return user_can_manage_contact(request.user, obj)
        if isinstance(obj, LeadActivity):
            return user_can_manage_lead(request.user, obj.lead)
        return False
