from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q

from employees.models import Employee


def user_has_hr_access(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_super_admin or user.role == user.Role.HR_ADMIN:
        return True
    if user.role != user.Role.EMPLOYEE:
        return False
    try:
        return user.employee_profile.department == Employee.Department.HR
    except ObjectDoesNotExist:
        return False


def get_hr_users():
    from accounts.models import User

    return User.objects.filter(is_active=True).filter(
        Q(role=User.Role.SUPER_ADMIN)
        | Q(role=User.Role.HR_ADMIN)
        | Q(role=User.Role.EMPLOYEE, employee_profile__department=Employee.Department.HR)
    )
