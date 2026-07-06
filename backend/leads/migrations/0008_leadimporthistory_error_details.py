from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0007_lead_foundation_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='leadimporthistory',
            name='error_details',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
