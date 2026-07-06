import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0002_alter_attendance_status_attendanceregularization'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendance',
            name='daily_report_summary',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendance',
            name='kpi_miss_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='attendance',
            name='kpi_snapshot',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendance',
            name='tomorrow_plan',
            field=models.TextField(blank=True),
        ),
    ]
