from django.db import migrations


def seed_hr_masters(apps, schema_editor):
    DepartmentMaster = apps.get_model('settings_app', 'DepartmentMaster')
    LeaveTypeMaster = apps.get_model('settings_app', 'LeaveTypeMaster')
    PolicyCategoryMaster = apps.get_model('settings_app', 'PolicyCategoryMaster')

    departments = [
        'Sales & Marketing',
        'HR',
        'Technology',
        'Operations',
        'Management',
        'Finance',
        'Admin',
    ]
    for name in departments:
        DepartmentMaster.objects.get_or_create(name=name, defaults={'is_active': True})

    leave_types = [
        ('CASUAL', 'Casual', 12, True),
        ('SICK', 'Sick', 6, True),
        ('EMERGENCY', 'Emergency', 3, True),
        ('PLANNED', 'Planned', 6, True),
        ('UNPAID', 'Unpaid', 0, False),
    ]
    for code, name, quota, is_paid in leave_types:
        LeaveTypeMaster.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'annual_quota': quota,
                'is_paid': is_paid,
                'is_active': True,
            },
        )

    categories = [
        ('LEAVE_POLICY', 'Leave Policy'),
        ('ATTENDANCE_POLICY', 'Attendance Policy'),
        ('WFH_POLICY', 'Work From Home Policy'),
        ('CODE_OF_CONDUCT', 'Code of Conduct'),
        ('DATA_SECURITY', 'Data Security Policy'),
        ('ASSET_USAGE', 'Asset Usage Policy'),
        ('PAYROLL_POLICY', 'Salary/Payroll Policy'),
        ('EXIT_POLICY', 'Exit Policy'),
        ('PROBATION_POLICY', 'Probation Policy'),
        ('ANTI_HARASSMENT', 'Anti-Harassment Policy'),
        ('OTHER', 'Other'),
    ]
    for code, name in categories:
        PolicyCategoryMaster.objects.get_or_create(
            code=code,
            defaults={'name': name, 'is_active': True},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('settings_app', '0005_hr_master_data'),
    ]

    operations = [
        migrations.RunPython(seed_hr_masters, noop_reverse),
    ]
