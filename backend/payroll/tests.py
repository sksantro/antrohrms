from decimal import Decimal

from common.models import AuditEvent
from common.testing import Fixture
from payroll.models import SalaryVersion


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


class PayrollRunTests(Fixture):
    """BRD §21: PT slabs, Decimal totals, approved run immutable, payslip privacy."""

    def setUp(self):
        super().setUp()
        self.a = self.as_user(self.admin)

    def calc(self, year=2026, month=10):
        return self.a.post("/api/v1/admin/payroll/runs", {"year": year, "month": month}, format="json")

    def test_pt_slabs(self):
        from payroll.services import professional_tax
        for gross, pt in ((15000, 0), (15001, 150), (20000, 150), (20001, 200)):
            self.assertEqual(professional_tax(self.org, Decimal(gross)), Decimal(pt), gross)

    def test_brd_example_and_lifecycle(self):
        SalaryVersion.objects.filter(employee=self.emp.employee).update(components=[
            {"code": "BASIC", "name": "Basic", "type": "EARNING", "amount": "15000.00"},
            {"code": "HRA", "name": "HRA", "type": "EARNING", "amount": "6000.00"},
            {"code": "SPECIAL", "name": "Special Allowance", "type": "EARNING", "amount": "9000.00"}])
        r = self.calc()
        self.assertEqual(r.status_code, 201, r.data)
        slip = next(s for s in r.data["payslips"] if s["employee_id"] == str(self.emp.employee.pk))
        self.assertEqual((slip["gross"], slip["deductions"], slip["net"]), (Decimal("30000.00"), Decimal("200.00"), Decimal("29800.00")))
        self.assertEqual([w["code"] for w in r.data["warnings"]], ["NO_SALARY"] * 4)  # others have no salary set
        # Not visible to the employee before approval.
        me = self.as_user(self.emp)
        self.assertEqual(me.get("/api/v1/payslips/me").data["payslips"], [])
        self.assertEqual(me.get(f"/api/v1/payslips/{slip['id']}").status_code, 422)
        # Unpaid days pro-rate earnings; adjustments need a note.
        url = f"/api/v1/admin/payroll/payslips/{slip['id']}"
        bad = self.a.patch(url, {"unpaid_days": "0", "adjustments": [{"name": "Bonus", "type": "EARNING", "amount": "1000", "note": ""}]}, format="json")
        self.assertEqual(bad.status_code, 400)
        r = self.a.patch(url, {"unpaid_days": "3.1", "adjustments": []}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.a.patch(url, {"unpaid_days": "1", "adjustments": []}, format="json")
        self.assertEqual(r.data["gross"], Decimal("29032.26"))  # 30000 × 30/31
        run_id = self.a.get("/api/v1/admin/payroll/runs").data["runs"][0]["id"]
        self.assertEqual(self.a.post(f"/api/v1/admin/payroll/runs/{run_id}/approve").data["status"], "APPROVED")
        # Locked: no recalculation or edits.
        self.assertEqual(self.calc().data["code"], "PAYROLL_LOCKED")
        self.assertEqual(self.a.patch(url, {"unpaid_days": "0", "adjustments": []}, format="json").status_code, 409)
        # Owner sees it; others can't.
        self.assertEqual(len(me.get("/api/v1/payslips/me").data["payslips"]), 1)
        self.assertEqual(me.get(f"/api/v1/payslips/{slip['id']}").status_code, 200)
        for u in (self.hr, self.mgr, self.other):
            self.assertEqual(self.as_user(u).get(f"/api/v1/payslips/{slip['id']}").status_code, 422)
            self.assertEqual(self.as_user(u).get("/api/v1/admin/payroll/runs").status_code, 403)
        self.assertEqual(self.a.post(f"/api/v1/admin/payroll/runs/{run_id}/paid").data["status"], "PAID")

    def test_negative_net_blocks_approval(self):
        r = self.calc()
        slip = r.data["payslips"][0]
        self.a.patch(f"/api/v1/admin/payroll/payslips/{slip['id']}", {"unpaid_days": "0", "adjustments": [
            {"name": "Advance recovery", "type": "DEDUCTION", "amount": "40000", "note": "Salary advance"}]}, format="json")
        r = self.a.post(f"/api/v1/admin/payroll/runs/{r.data['id']}/approve")
        self.assertEqual(r.data["code"], "PAYROLL_EXCEPTIONS")

    def test_future_month_refused(self):
        self.assertEqual(self.calc(2030, 1).data["code"], "FUTURE_MONTH")
