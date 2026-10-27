"""`migrate`, plus a one-time safety step for servers that ran the previous Antro HRMS codebase.

The previous app used the same app labels (accounts, employees, payroll…) with a different schema,
so Django would treat its migrations as already applied. If that legacy schema is detected on
PostgreSQL, the whole `public` schema is renamed to `legacy_<timestamp>` (data kept as a backup,
nothing deleted) and a fresh `public` schema is created before migrating.
"""
from django.core.management.base import CommandError
from django.core.management.commands.migrate import Command as MigrateCommand
from django.db import connections
from django.utils import timezone

# Apps that only existed in the previous codebase.
LEGACY_ONLY_APPS = {"leads", "attendance", "leaves", "documents", "settings_app", "policies", "audit_logs"}


def is_legacy_schema(applied_apps: set[str]) -> bool:
    """True when the database was migrated by the previous codebase and never by this one."""
    if "common" in applied_apps:
        return False
    return bool(applied_apps & LEGACY_ONLY_APPS) or "accounts" in applied_apps


def applied_apps(connection) -> set[str]:
    if "django_migrations" not in connection.introspection.table_names():
        return set()
    with connection.cursor() as c:
        c.execute("SELECT DISTINCT app FROM django_migrations")
        return {row[0] for row in c.fetchall()}


class Command(MigrateCommand):
    def handle(self, *args, **options):
        connection = connections[options["database"]]
        if is_legacy_schema(applied_apps(connection)):
            if connection.vendor != "postgresql":
                raise CommandError("A database from the previous Antro HRMS app was found. Point DATABASES at a new database and retry.")
            backup = f"legacy_{timezone.now():%Y%m%d_%H%M}"
            self.stdout.write(self.style.WARNING(f"Previous-app schema detected. Moving it to schema '{backup}' (kept as a backup) and starting fresh."))
            try:
                with connection.cursor() as c:
                    c.execute(f'ALTER SCHEMA public RENAME TO "{backup}"')
                    c.execute("CREATE SCHEMA public")
            except Exception as exc:
                raise CommandError(
                    f"Couldn't move the old schema ({exc.__class__.__name__}: {exc}). "
                    "Run as the database owner, or point the app at a new empty database."
                ) from exc
            connection.close()  # reconnect so the new public schema is on the search path
        return super().handle(*args, **options)
