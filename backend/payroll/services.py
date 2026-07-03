from payroll.models import SalaryStructure


def deactivate_other_active_structures(employee_id: int, exclude_id: int | None = None) -> int:
    queryset = SalaryStructure.objects.filter(employee_id=employee_id, is_active=True)
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)
    return queryset.update(is_active=False)
