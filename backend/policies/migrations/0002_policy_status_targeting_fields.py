from django.db import migrations, models


def backfill_policy_status(apps, schema_editor):
    Policy = apps.get_model('policies', 'Policy')
    for policy in Policy.objects.all():
        policy.status = 'PUBLISHED' if policy.is_active else 'UNPUBLISHED'
        policy.applies_to = 'ALL_EMPLOYEES'
        policy.requires_acknowledgement = True
        policy.save(
            update_fields=[
                'status',
                'is_active',
                'applies_to',
                'requires_acknowledgement',
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ('policies', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='policy',
            name='applies_to',
            field=models.CharField(
                choices=[
                    ('ALL_EMPLOYEES', 'All Employees'),
                    ('DEPARTMENT', 'Department-wise'),
                    ('DESIGNATION', 'Designation-wise'),
                    ('SPECIFIC_EMPLOYEES', 'Specific Employees'),
                ],
                default='ALL_EMPLOYEES',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='policy',
            name='applies_to_departments',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='policy',
            name='applies_to_designations',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='policy',
            name='applies_to_employees',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='policy',
            name='policy_content',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='policy',
            name='requires_acknowledgement',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='policy',
            name='status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Draft'),
                    ('PUBLISHED', 'Published'),
                    ('UNPUBLISHED', 'Unpublished'),
                    ('ARCHIVED', 'Archived'),
                ],
                default='DRAFT',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='policy',
            name='is_active',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='policy',
            name='policy_file',
            field=models.FileField(blank=True, null=True, upload_to='policies/'),
        ),
        migrations.RunPython(backfill_policy_status, migrations.RunPython.noop),
    ]
