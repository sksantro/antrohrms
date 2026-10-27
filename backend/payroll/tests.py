from common.models import AuditEvent
from common.testing import Fixture


class CompensationPrivacyTests(Fixture):
    """P0 proof (BRD §20): HR cannot query salaries."""

    def url(self, user):
        return f"/api/v1/admin/compensation/{user.employee.pk}"

    def test_hr_gets_403_and_no_salary_payload(self):
        r = self.as_user(self.hr).get(self.url(self.emp))
        self.assertEqual(r.status_code, 403)
        self.assertNotIn("30000", r.content.decode())

    def test_hr_cannot_read_own_salary_via_admin_route(self):
        self.assertEqual(self.as_user(self.hr).get(self.url(self.hr)).status_code, 403)

    def test_employee_and_manager_get_403(self):
        for u in (self.emp, self.mgr):
            self.assertEqual(self.as_user(u).get(self.url(self.emp)).status_code, 403)

    def test_admin_reads_salary_history(self):
        r = self.as_user(self.admin).get(self.url(self.emp))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["versions"][0]["monthly_gross"], "30000.00")


class SalaryVersionTests(Fixture):
    def post(self, user, **over):
        body = {"effective_from": "2026-12-01", "monthly_gross": "35000.00", "components": [
            {"code": "BASIC", "name": "Basic", "type": "EARNING", "amount": "17500.00"},
            {"code": "HRA", "name": "HRA", "type": "EARNING", "amount": "17500.00"}], **over}
        return self.as_user(user).post(f"/api/v1/admin/compensation/{self.emp.employee.pk}", body, format="json")

    def test_admin_adds_future_version_and_audit_hides_amount(self):
        self.assertEqual(self.post(self.admin).status_code, 201)
        ev = AuditEvent.objects.get(action="SALARY_VERSION_CREATED")
        self.assertNotIn("35000", str(ev.after))

    def test_effective_date_collision(self):
        self.post(self.admin)
        r = self.post(self.admin)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.data["code"], "EFFECTIVE_DATE_COLLISION")

    def test_components_must_sum_to_gross(self):
        r = self.post(self.admin, monthly_gross="40000.00")
        self.assertEqual(r.status_code, 400)
        self.assertIn("components", r.data["field_errors"])

    def test_hr_cannot_create_salary(self):
        self.assertEqual(self.post(self.hr).status_code, 403)


class AuditAccessTests(Fixture):
    def test_only_admin_reads_audit_and_it_is_read_only(self):
        self.assertEqual(self.as_user(self.hr).get("/api/v1/admin/audit").status_code, 403)
        c = self.as_user(self.admin)
        self.assertEqual(c.get("/api/v1/admin/audit").status_code, 200)
        self.assertEqual(c.delete("/api/v1/admin/audit").status_code, 405)

    def test_audit_rows_cannot_be_modified(self):
        from accounts.models import User
        from common.services import audit
        ev = audit(actor=self.admin, action="X", entity=User.objects.first(), organization=self.org)
        with self.assertRaises(RuntimeError):
            ev.reason = "tamper"
            ev.save()
        with self.assertRaises(RuntimeError):
            ev.delete()
