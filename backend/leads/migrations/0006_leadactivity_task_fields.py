import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def populate_activity_task_fields(apps, schema_editor):
    LeadActivity = apps.get_model('leads', 'LeadActivity')
    for activity in LeadActivity.objects.select_related('created_by').all().iterator():
        activity.assigned_to_id = activity.created_by_id
        activity.status = 'DONE'
        activity.completed_at = activity.created_at
        activity.save(update_fields=['assigned_to_id', 'status', 'completed_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0005_leadbulkuploadsession_leadimporthistory'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='leadactivity',
            name='completion_notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='leadactivity',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='leadactivity',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='leadactivity',
            name='priority',
            field=models.CharField(
                choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High')],
                default='MEDIUM',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='leadactivity',
            name='status',
            field=models.CharField(
                choices=[
                    ('OPEN', 'Open'),
                    ('IN_PROGRESS', 'In Progress'),
                    ('DONE', 'Done'),
                    ('CLOSED', 'Closed'),
                ],
                default='OPEN',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='leadactivity',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='leadactivity',
            name='assigned_to',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='assigned_lead_activities',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(populate_activity_task_fields, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='leadactivity',
            name='assigned_to',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='assigned_lead_activities',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
