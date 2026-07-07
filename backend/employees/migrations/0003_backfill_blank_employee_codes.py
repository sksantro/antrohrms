from django.db import migrations


CODE_PREFIX = 'ANT-EMP-'


def _next_code(counter: int) -> str:
    return f'{CODE_PREFIX}{counter:04d}'


def backfill_blank_employee_codes(apps, schema_editor):
    Employee = apps.get_model('employees', 'Employee')

    max_num = 0
    for code in Employee.objects.values_list('employee_code', flat=True):
        if not code or not code.startswith(CODE_PREFIX):
            continue
        suffix = code[len(CODE_PREFIX):]
        if suffix.isdigit():
            max_num = max(max_num, int(suffix))

    missing_code_employees = Employee.objects.filter(employee_code__in=['', None]).order_by('id')
    next_num = max_num + 1

    for employee in missing_code_employees:
        employee.employee_code = _next_code(next_num)
        employee.save(update_fields=['employee_code'])
        next_num += 1


class Migration(migrations.Migration):
    dependencies = [
        ('employees', '0002_employee_internship_end_date_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_blank_employee_codes, migrations.RunPython.noop),
    ]
