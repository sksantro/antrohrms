"""`migrate`, plus a one-time safety step for servers that ran the previous Antro HRMS codebase.

The previous app used the same app labels (accounts, employees, payroll…) with a different schema,
so Django would treat its migrations as already applied. If that legacy schema is detected on
PostgreSQL, its objects are moved out of the way (nothing is deleted) before migrating:

1. Preferred: rename the whole `public` schema to `legacy_<timestamp>` and create a fresh `public`.
2. If the app's database user doesn't own `public` (common on managed servers), rename every table,
   index, sequence and view the user owns in `public` to `old_<name>` instead, in one transaction.
"""
import hashlib

from django.core.management.base import CommandError
from django.core.management.commands.migrate import Command as MigrateCommand
from django.db import DatabaseError, connections, transaction
from django.utils import timezone

# Apps that only existed in the previous codebase.
LEGACY_ONLY_APPS = {"leads", "attendance", "leaves", "documents", "settings_app", "policies", "audit_logs"}
PREFIX = "old_"
_KIND = {"r": "TABLE", "p": "TABLE", "v": "VIEW", "m": "MATERIALIZED VIEW", "S": "SEQUENCE", "i": "INDEX"}


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


def legacy_name(name: str) -> str:
    """old_<name>, kept within PostgreSQL's 63-byte identifier limit."""
    new = PREFIX + name
    if len(new.encode()) <= 63:
        return new
    digest = hashlib.sha1(name.encode()).hexdigest()[:8]
    return f"{PREFIX}{name[: 63 - len(PREFIX) - 9]}_{digest}"


def rename_owned_objects(cursor) -> int:
    """Rename every relation in `public` owned by the current user. Indexes and sequences too, so the
    new tables' constraint/sequence names don't collide. Index-backed constraints follow their index."""
    cursor.execute(
        """
        SELECT c.relname, c.relkind FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND pg_get_userbyid(c.relowner) = current_user
          AND c.relkind IN ('r','p','v','m','S','i') AND c.relname NOT LIKE %s
        ORDER BY CASE c.relkind WHEN 'i' THEN 1 WHEN 'S' THEN 2 ELSE 0 END, c.relname
        """,
        [PREFIX + "%"],
    )
    rows = cursor.fetchall()
    for name, kind in rows:
        cursor.execute(f'ALTER {_KIND[kind]} public."{name}" RENAME TO "{legacy_name(name)}"')
    return len(rows)


class Command(MigrateCommand):
    def handle(self, *args, **options):
        connection = connections[options["database"]]
        if is_legacy_schema(applied_apps(connection)):
            if connection.vendor != "postgresql":
                raise CommandError("A database from the previous Antro HRMS app was found. Point DATABASES at a new database and retry.")
            self.move_legacy_out_of_the_way(connection)
        return super().handle(*args, **options)

    def move_legacy_out_of_the_way(self, connection):
        backup = f"legacy_{timezone.now():%Y%m%d_%H%M}"
        self.stdout.write(self.style.WARNING("Previous-app database detected; moving it aside (nothing is deleted)."))
        try:
            with transaction.atomic(using=connection.alias), connection.cursor() as c:
                c.execute(f'ALTER SCHEMA public RENAME TO "{backup}"')
                c.execute("CREATE SCHEMA public")
            self.stdout.write(f"Old schema kept as '{backup}'.")
        except DatabaseError:
            try:
                with transaction.atomic(using=connection.alias), connection.cursor() as c:
                    n = rename_owned_objects(c)
            except DatabaseError as exc:
                raise CommandError(
                    f"Couldn't move the old tables aside ({exc.__class__.__name__}: {exc}). "
                    "Run as the database owner, or point the app at a new empty database."
                ) from exc
            self.stdout.write(f"Renamed {n} old tables, indexes and sequences to '{PREFIX}<name>' in schema public.")
        connection.close()  # reconnect so introspection sees the fresh state
