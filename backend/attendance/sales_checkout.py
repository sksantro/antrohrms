from django.core.exceptions import ObjectDoesNotExist

from employees.models import Employee


def is_sales_marketing_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    try:
        return user.employee_profile.department == Employee.Department.SALES_MARKETING
    except ObjectDoesNotExist:
        return False
