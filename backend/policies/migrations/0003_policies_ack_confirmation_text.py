from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('policies', '0002_policy_status_targeting_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='policyacknowledgement',
            name='confirmation_text',
            field=models.TextField(blank=True),
        ),
    ]
