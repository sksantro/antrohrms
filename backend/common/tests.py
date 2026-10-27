from django.test import TestCase

# Create your tests here.


class LegacySchemaDetectionTests(TestCase):
    def test_detection(self):
        from common.management.commands.migrate import applied_apps, is_legacy_schema
        self.assertTrue(is_legacy_schema({"admin", "auth", "accounts", "leads"}))
        self.assertTrue(is_legacy_schema({"admin", "accounts", "employees"}))
        self.assertFalse(is_legacy_schema({"admin", "accounts", "common", "employees"}))
        self.assertFalse(is_legacy_schema(set()))
        from django.db import connection
        self.assertFalse(is_legacy_schema(applied_apps(connection)))  # the test DB was built by this codebase


class BootstrapAdminTests(TestCase):
    def test_creates_org_and_super_admin(self):
        from unittest import mock
        from django.core.management import call_command
        from accounts.models import User
        with mock.patch("getpass.getpass", return_value="Very-strong-pass-42"):
            call_command("bootstrap_admin", email="Owner@Example.com", name="Owner Person", stdout=open(__import__("os").devnull, "w"))
        u = User.objects.get(email="owner@example.com")
        self.assertTrue(u.check_password("Very-strong-pass-42"))
        self.assertIn("SUPER_ADMIN", u.role_set)
        self.assertEqual(u.employee.employee_code, "APT0001")

    def test_env_password_and_refuses_second_admin(self):
        from unittest import mock
        from django.core.management import CommandError, call_command
        from accounts.models import User
        null = open(__import__("os").devnull, "w")
        with mock.patch.dict("os.environ", {"ADMIN_BOOTSTRAP_PASSWORD": "Env-strong-pass-42"}):
            call_command("bootstrap_admin", email="first@example.com", name="First", stdout=null)
            self.assertTrue(User.objects.get(email="first@example.com").check_password("Env-strong-pass-42"))
            with self.assertRaisesMessage(CommandError, "already exists"):
                call_command("bootstrap_admin", email="second@example.com", name="Second", stdout=null)

    def test_weak_env_password_rejected(self):
        from unittest import mock
        from django.core.management import CommandError, call_command
        with mock.patch.dict("os.environ", {"ADMIN_BOOTSTRAP_PASSWORD": "short"}), self.assertRaises(CommandError):
            call_command("bootstrap_admin", email="weak@example.com", name="Weak", stdout=open(__import__("os").devnull, "w"))


class LegacyNameTests(TestCase):
    def test_names_stay_within_postgres_limit_and_unique(self):
        from common.management.commands.migrate import legacy_name
        self.assertEqual(legacy_name("accounts_user"), "old_accounts_user")
        a, b = legacy_name("x" * 60 + "_a"), legacy_name("x" * 60 + "_b")
        self.assertLessEqual(len(a), 63)
        self.assertNotEqual(a, b)
