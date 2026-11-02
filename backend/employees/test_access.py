"""Access management: four roles, designation rules and reporting-line RM."""
from accounts.models import RoleAssignment
from common.testing import Fixture


class AccessTests(Fixture):
    def roles(self, user):
        return dict(RoleAssignment.objects.filter(user=user).values_list("role", "source"))

    def rule(self, designation, roles, user=None):
        return self.as_user(user or self.admin).put("/api/v1/admin/access/designation-rules", {"designation": designation, "roles": roles}, format="json")

    def test_only_super_admin(self):
        for u in (self.hr, self.mgr, self.emp):
            self.assertEqual(self.as_user(u).get("/api/v1/admin/access").status_code, 403)
            self.assertEqual(self.rule("Engineer", ["HR_OPERATIONS"], user=u).status_code, 403)
        r = self.as_user(self.admin).get("/api/v1/admin/access")
        self.assertEqual([x["role"] for x in r.data["roles"]], ["SUPER_ADMIN", "HR_OPERATIONS", "REPORTING_MANAGER", "EMPLOYEE"])

    def test_designation_rule_adds_and_removes_hr(self):
        emp = self.emp.employee
        emp.designation = "HR Executive"
        emp.save()
        r = self.rule("hr executive", ["HR_OPERATIONS"])
        self.assertEqual(r.data["people_updated"], 1)
        self.assertEqual(self.roles(self.emp).get("HR_OPERATIONS"), "DESIGNATION")
        emp.designation = "Engineer"  # moving out of the designation removes the automatic role
        emp.save()
        self.assertNotIn("HR_OPERATIONS", self.roles(self.emp))
        self.assertEqual(self.rule("Engineer", ["SUPER_ADMIN"]).status_code, 400)  # Super Admin is never automatic

    def test_reporting_line_makes_rm_and_manual_roles_stay(self):
        self.assertNotIn("REPORTING_MANAGER", self.roles(self.other))
        self.emp.employee.reporting_manager = self.other.employee
        self.emp.employee.save()
        self.assertEqual(self.roles(self.other).get("REPORTING_MANAGER"), "REPORTING_LINE")
        self.emp.employee.reporting_manager = None
        self.emp.employee.save()
        self.assertNotIn("REPORTING_MANAGER", self.roles(self.other))
        self.assertEqual(self.roles(self.mgr).get("REPORTING_MANAGER"), "MANUAL")  # hand-given role untouched

    def test_interviewer_not_assignable(self):
        r = self.as_user(self.admin).put(f"/api/v1/admin/employees/{self.emp.employee.pk}/roles", {"roles": ["INTERVIEWER"]}, format="json")
        self.assertEqual(r.status_code, 400)
