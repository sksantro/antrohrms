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
        self.assertEqual(u.employee.employee_code, "APT-0001")
