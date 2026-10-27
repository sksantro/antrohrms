from datetime import date

from django.core import mail

from accounts.models import Invite
from common.models import AuditEvent, NotificationOutbox
from common.testing import Fixture
from employees.models import Employee, add_months

SALARY_WORDS = ("salary", "gross", "monthly_gross", "components", "ctc", "30000")


class ProbationDateTests(Fixture):
    def test_month_end_edge_cases(self):
        self.assertEqual(add_months(date(2026, 1, 31), 1), date(2026, 2, 28))
        self.assertEqual(add_months(date(2028, 11, 30), 3), date(2029, 2, 28))
        self.assertEqual(add_months(date(2026, 10, 27), 3), date(2027, 1, 27))
        self.assertEqual(self.emp.employee.probation_end, date(2026, 4, 30))


class DirectoryAccessTests(Fixture):
    def test_admin_and_hr_can_list(self):
        for u in (self.admin, self.hr):
            r = self.as_user(u).get("/api/v1/employees")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.data["count"], 5)

    def test_hr_directory_has_no_salary_data(self):
        body = self.as_user(self.hr).get("/api/v1/employees").content.decode().lower()
        for w in SALARY_WORDS:
            self.assertNotIn(w, body)

    def test_employee_cannot_list_directory(self):
        for u in (self.emp, self.mgr):
            self.assertEqual(self.as_user(u).get("/api/v1/employees").status_code, 403)

    def test_employee_sees_self_but_others_are_404(self):
        c = self.as_user(self.emp)
        self.assertEqual(c.get(f"/api/v1/employees/{self.emp.employee.pk}").status_code, 200)
        self.assertEqual(c.get("/api/v1/employees/me").data["employee_code"], "T-emp")
        self.assertEqual(c.get(f"/api/v1/employees/{self.other.employee.pk}").status_code, 404)  # IDOR obscured

    def test_hr_does_not_see_personal_fields_of_others(self):
        r = self.as_user(self.hr).get(f"/api/v1/employees/{self.emp.employee.pk}")
        self.assertNotIn("address", r.data)
        self.assertNotIn("emergency_contact", r.data)

    def test_anonymous_gets_401(self):
        from rest_framework.test import APIClient
        self.assertEqual(APIClient().get("/api/v1/employees").status_code, 401)


class InviteEmployeeTests(Fixture):
    def payload(self, **extra):
        return {"display_name": "New Person", "official_email": "New@test.example", "department_id": str(self.dept.pk),
                "designation": "QA Engineer", "start_date": "2026-11-02", **extra}

    def test_admin_creates_and_invites_employee(self):
        r = self.as_user(self.admin).post("/api/v1/employees", self.payload(roles=["INTERVIEWER"]), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertRegex(r.data["invite_url"], r"/activate\?token=[\w-]{30,}$")
        emp = Employee.objects.get(official_email="new@test.example")
        self.assertRegex(emp.employee_code, r"^APT\d{4}$")
        self.assertEqual(emp.probation_end, date(2027, 2, 2))
        self.assertEqual(sorted(emp.user.role_set), ["EMPLOYEE", "INTERVIEWER"])
        self.assertFalse(emp.user.has_usable_password())  # no plaintext temp password
        self.assertTrue(Invite.objects.filter(user=emp.user, used_at__isnull=True).exists())
        self.assertEqual(NotificationOutbox.objects.filter(recipient="new@test.example").count(), 1)
        self.assertTrue(AuditEvent.objects.filter(action="EMPLOYEE_CREATED", entity_id=str(emp.pk)).exists())

    def test_invite_email_delivered_after_commit(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.as_user(self.admin).post("/api/v1/employees", self.payload(), format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/activate?token=", mail.outbox[0].body)
        self.assertEqual(NotificationOutbox.objects.get().status, "SENT")

    def test_hr_can_create_but_not_grant_roles(self):
        c = self.as_user(self.hr)
        self.assertEqual(c.post("/api/v1/employees", self.payload(roles=["SUPER_ADMIN"]), format="json").status_code, 403)
        self.assertEqual(c.post("/api/v1/employees", self.payload(), format="json").status_code, 201)

    def test_employee_cannot_create(self):
        self.assertEqual(self.as_user(self.emp).post("/api/v1/employees", self.payload(), format="json").status_code, 403)

    def test_duplicate_email_conflict(self):
        r = self.as_user(self.admin).post("/api/v1/employees", self.payload(official_email="emp@test.example"), format="json")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.data["code"], "DUPLICATE_EMAIL")


class UpdateAndRoleTests(Fixture):
    def test_self_edit_limited_to_personal_fields(self):
        c = self.as_user(self.emp)
        url = f"/api/v1/employees/{self.emp.employee.pk}"
        self.assertEqual(c.patch(url, {"phone": "9000000000"}, format="json").status_code, 200)
        self.assertEqual(c.patch(url, {"designation": "CTO"}, format="json").status_code, 403)

    def test_hr_cannot_change_own_operational_fields(self):
        r = self.as_user(self.hr).patch(f"/api/v1/employees/{self.hr.employee.pk}", {"designation": "Head of HR"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_hr_edits_operational_field_and_audit_has_before_after(self):
        r = self.as_user(self.hr).patch(f"/api/v1/employees/{self.emp.employee.pk}", {"designation": "Senior Engineer"}, format="json")
        self.assertEqual(r.status_code, 200)
        ev = AuditEvent.objects.get(action="EMPLOYEE_UPDATED")
        self.assertEqual(ev.before, {"designation": "Engineer"})
        self.assertEqual(ev.after, {"designation": "Senior Engineer"})
        self.assertEqual(ev.actor, self.hr)

    def test_hr_cannot_change_status(self):
        r = self.as_user(self.hr).patch(f"/api/v1/employees/{self.emp.employee.pk}", {"status": "ACTIVE_CONFIRMED"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_only_admin_changes_roles(self):
        url = f"/api/v1/admin/employees/{self.emp.employee.pk}/roles"
        self.assertEqual(self.as_user(self.hr).put(url, {"roles": ["HR_OPERATIONS"]}, format="json").status_code, 403)
        r = self.as_user(self.admin).put(url, {"roles": ["INTERVIEWER"]}, format="json")
        self.assertEqual(r.data["roles"], ["EMPLOYEE", "INTERVIEWER"])

    def test_admin_cannot_remove_own_admin_role(self):
        r = self.as_user(self.admin).put(f"/api/v1/admin/employees/{self.admin.employee.pk}/roles", {"roles": []}, format="json")
        self.assertEqual(r.data["code"], "SELF_LOCKOUT")


class InviteLinkTests(Fixture):
    def test_resend_returns_new_working_link_and_revokes_old(self):
        from rest_framework.test import APIClient
        emp = self.make("pending", [])
        emp.set_unusable_password()
        emp.save()
        c = self.as_user(self.hr)
        first = c.post(f"/api/v1/employees/{emp.employee.pk}/resend-invite").data["invite_url"]
        second = c.post(f"/api/v1/employees/{emp.employee.pk}/resend-invite").data["invite_url"]
        tok = lambda url: url.split("token=")[1]
        self.assertEqual(APIClient().get(f"/api/v1/auth/activate?token={tok(first)}").status_code, 422)
        self.assertEqual(APIClient().get(f"/api/v1/auth/activate?token={tok(second)}").status_code, 200)

    def test_employee_cannot_get_invite_link(self):
        self.assertEqual(self.as_user(self.emp).post(f"/api/v1/employees/{self.other.employee.pk}/resend-invite").status_code, 403)


class FormerFilterTests(Fixture):
    def test_former_employees_hidden_by_default(self):
        Employee.objects.filter(pk=self.other.employee.pk).update(status=Employee.Status.EXITED)
        c = self.as_user(self.admin)
        self.assertEqual(c.get("/api/v1/employees").data["count"], 4)
        former = c.get("/api/v1/employees?former=1").data
        self.assertEqual([e["employee_code"] for e in former["results"]], ["T-other"])
