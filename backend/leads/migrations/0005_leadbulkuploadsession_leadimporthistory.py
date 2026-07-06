import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0004_leadactivity_kpi_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadBulkUploadSession',
            fields=[
                ('id', models.UUIDField(editable=False, primary_key=True, serialize=False)),
                ('file_name', models.CharField(max_length=255)),
                ('sheets_data', models.JSONField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lead_bulk_upload_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.CreateModel(
            name='LeadImportHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_name', models.CharField(max_length=255)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('imported_rows', models.PositiveIntegerField(default=0)),
                ('skipped_rows', models.PositiveIntegerField(default=0)),
                ('failed_rows', models.PositiveIntegerField(default=0)),
                ('sheet_name', models.CharField(blank=True, max_length=100)),
                ('column_mapping', models.JSONField(blank=True, null=True)),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='lead_import_histories', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name_plural': 'Lead import histories',
                'ordering': ('-uploaded_at',),
            },
        ),
    ]
