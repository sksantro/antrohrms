import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0003_leadactivity_leadstatuschange'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='leadactivity',
            name='is_countable_for_kpi',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='leadstatuschange',
            name='is_countable_for_kpi',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='leadstatuschange',
            name='remarks',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='leadactivity',
            name='activity_type',
            field=models.CharField(
                choices=[
                    ('LINKEDIN_MESSAGE_SENT', 'LinkedIn Message Sent'),
                    ('COLD_CALL_MADE', 'Cold Call Made'),
                    ('FOLLOW_UP_DONE', 'Follow-up Done'),
                    ('MEETING_DEMO_BOOKED', 'Meeting / Demo Booked'),
                    ('EMAIL_SENT', 'Email Sent'),
                    ('PROPOSAL_SENT', 'Proposal Sent'),
                    ('GENERAL_NOTE', 'General Note'),
                ],
                max_length=40,
            ),
        ),
    ]
