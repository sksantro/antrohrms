from datetime import timedelta

from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Invite
from common.models import AuditEvent
from common.testing import PASSWORD, Fixture


class AuthTests(Fixture):
    def csrf_client(self) -> APIClient:
        c = APIClient(enforce_csrf_checks=True)
        c.get("/api/v1/auth/csrf")
        c.credentials(HTTP_X_CSRFTOKEN=c.cookies["csrftoken"].value)
        return c

    def test_login_success_returns_roles_and_sets_session(self):
        c = self.csrf_client()
        r = c.post("/api/v1/auth/login", {"email": "HR@test.example", "password": PASSWORD}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["roles"], ["EMPLOYEE", "HR_OPERATIONS"])
        self.assertIn("sessionid", c.cookies)
        self.assertTrue(c.cookies["sessionid"]["httponly"])
        self.assertEqual(c.get("/api/v1/auth/me").data["email"], "hr@test.example")
        self.assertTrue(AuditEvent.objects.filter(action="AUTH_LOGIN", actor=self.hr).exists())

    def test_login_wrong_password_is_generic(self):
        c = self.csrf_client()
        bad = c.post("/api/v1/auth/login", {"email": "hr@test.example", "password": "nope"}, format="json")
        unknown = c.post("/api/v1/auth/login", {"email": "ghost@test.example", "password": "nope"}, format="json")
        self.assertEqual(bad.status_code, 422)
        self.assertEqual(bad.data["code"], "INVALID_CREDENTIALS")
        self.assertEqual(bad.data["message"], unknown.data["message"])  # no account enumeration
        self.assertTrue(bad.data["request_id"])

    def test_login_requires_csrf(self):
        c = APIClient(enforce_csrf_checks=True)
        r = c.post("/api/v1/auth/login", {"email": "hr@test.example", "password": PASSWORD}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_inactive_user_cannot_login(self):
        self.other.is_active = False
        self.other.save()
        r = self.csrf_client().post("/api/v1/auth/login", {"email": "other@test.example", "password": PASSWORD}, format="json")
        self.assertEqual(r.status_code, 422)

    def test_me_requires_login(self):
        r = APIClient().get("/api/v1/auth/me")
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data["code"], "NOT_AUTHENTICATED")

    def test_logout_ends_session(self):
        c = self.csrf_client()
        c.post("/api/v1/auth/login", {"email": "emp@test.example", "password": PASSWORD}, format="json")
        c.credentials(HTTP_X_CSRFTOKEN=c.cookies["csrftoken"].value)  # token rotates on login
        self.assertEqual(c.post("/api/v1/auth/logout").status_code, 204)
        self.assertEqual(c.get("/api/v1/auth/me").status_code, 401)
        self.assertEqual(AuditEvent.objects.get(action="AUTH_LOGOUT").entity_type, "User")


class ActivationTests(Fixture):
    def invite(self):
        user = self.make("newbie", [])
        user.set_unusable_password()
        user.save()
        invite, token = Invite.issue(user, created_by=self.admin)
        return user, invite, token

    def post(self, token, password="Str0ng-and-l0ng!", accept=True):
        return APIClient().post("/api/v1/auth/activate", {"token": token, "password": password, "accept_policy": accept}, format="json")

    def test_activate_sets_password_and_logs_in(self):
        user, invite, token = self.invite()
        self.assertEqual(APIClient().get(f"/api/v1/auth/activate?token={token}").data["email"], user.email)
        r = self.post(token)
        self.assertEqual(r.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("Str0ng-and-l0ng!"))
        self.assertIsNotNone(user.policy_accepted_at)

    def test_token_is_single_use(self):
        _, _, token = self.invite()
        self.post(token)
        self.assertEqual(self.post(token).data["code"], "INVITE_INVALID")

    def test_expired_token_rejected(self):
        _, invite, token = self.invite()
        Invite.objects.filter(pk=invite.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.post(token).data["code"], "INVITE_INVALID")

    def test_weak_password_and_missing_consent_rejected(self):
        _, _, token = self.invite()
        self.assertIn("password", self.post(token, password="123").data["field_errors"])
        self.assertIn("accept_policy", self.post(token, accept=False).data["field_errors"])

    def test_only_hash_of_token_is_stored(self):
        _, invite, token = self.invite()
        self.assertNotEqual(invite.token_hash, token)
        self.assertEqual(len(mail.outbox), 0)  # Invite.issue alone sends nothing; the service queues email


class PasswordTests(Fixture):
    def login(self, email, password):
        c = APIClient()
        r = c.post("/api/v1/auth/login", {"email": email, "password": password}, format="json")
        return c, r.status_code

    def test_change_password(self):
        c, _ = self.login("emp@test.example", PASSWORD)
        other, _ = self.login("emp@test.example", PASSWORD)  # a second device
        bad = c.post("/api/v1/auth/change-password", {"current_password": "wrong", "new_password": "Brand-new-pass-77"}, format="json")
        self.assertIn("current_password", bad.data["field_errors"])
        weak = c.post("/api/v1/auth/change-password", {"current_password": PASSWORD, "new_password": "123"}, format="json")
        self.assertIn("new_password", weak.data["field_errors"])
        ok = c.post("/api/v1/auth/change-password", {"current_password": PASSWORD, "new_password": "Brand-new-pass-77"}, format="json")
        self.assertEqual(ok.status_code, 204)
        self.assertEqual(c.get("/api/v1/auth/me").status_code, 200)       # this session stays signed in
        self.assertEqual(other.get("/api/v1/auth/me").status_code, 401)   # other devices are signed out
        self.assertEqual(self.login("emp@test.example", "Brand-new-pass-77")[1], 200)
        self.assertTrue(AuditEvent.objects.filter(action="PASSWORD_CHANGED").exists())

    def test_reset_link_for_activated_employee(self):
        r = self.as_user(self.hr).post(f"/api/v1/employees/{self.emp.employee.pk}/resend-invite")
        self.assertEqual(r.data["kind"], "reset")
        token = r.data["invite_url"].split("token=")[1]
        self.assertTrue(APIClient().get(f"/api/v1/auth/activate?token={token}").data["is_reset"])
        self.assertEqual(self.login("emp@test.example", PASSWORD)[1], 200)  # old password works until the link is used
        APIClient().post("/api/v1/auth/activate", {"token": token, "password": "Reset-pass-2026x", "accept_policy": True}, format="json")
        self.assertEqual(self.login("emp@test.example", PASSWORD)[1], 422)
        self.assertEqual(self.login("emp@test.example", "Reset-pass-2026x")[1], 200)

    def test_hr_cannot_reset_super_admin_and_nobody_resets_former_staff(self):
        self.assertEqual(self.as_user(self.hr).post(f"/api/v1/employees/{self.admin.employee.pk}/resend-invite").status_code, 403)
        self.other.is_active = False
        self.other.save()
        r = self.as_user(self.admin).post(f"/api/v1/employees/{self.other.employee.pk}/resend-invite")
        self.assertEqual(r.data["code"], "ACCOUNT_INACTIVE")
