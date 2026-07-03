from django.apps import AppConfig


class PoliciesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'policies'

    def ready(self):
        import policies.signals  # noqa: F401
    verbose_name = 'Policies'
