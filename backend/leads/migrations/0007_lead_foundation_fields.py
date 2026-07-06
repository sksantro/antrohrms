import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Max


def populate_lead_foundation_fields(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    LeadActivity = apps.get_model('leads', 'LeadActivity')

    activity_dates = {
        row['lead_id']: row['latest']
        for row in LeadActivity.objects.values('lead_id').annotate(latest=Max('created_at'))
    }

    for lead in Lead.objects.all().iterator():
        lead.lead_owner_id = lead.created_by_id
        lead.last_activity_date = activity_dates.get(lead.id)
        lead.save(update_fields=['lead_owner_id', 'last_activity_date'])


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0006_leadactivity_task_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='lead',
            name='company_size',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='lead',
            name='source',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='lead',
            name='priority',
            field=models.CharField(
                choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High')],
                default='MEDIUM',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='lead',
            name='next_follow_up_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='last_activity_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='lead_owner',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='owned_leads',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='lead',
            name='last_updated_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='last_updated_leads',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='lead',
            name='current_status',
            field=models.CharField(
                choices=[
                    ('NEW', 'New'),
                    ('CONTACTED', 'Contacted'),
                    ('INTERESTED', 'Interested'),
                    ('FOLLOW_UP_REQUIRED', 'Follow-up Required'),
                    ('MEETING_BOOKED', 'Meeting Booked'),
                    ('PROPOSAL_SENT', 'Proposal Sent'),
                    ('NOT_INTERESTED', 'Not Interested'),
                    ('CLOSED', 'Closed'),
                    ('LOST', 'Lost'),
                ],
                default='NEW',
                max_length=30,
            ),
        ),
        migrations.RunPython(populate_lead_foundation_fields, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='lead',
            name='lead_owner',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='owned_leads',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
