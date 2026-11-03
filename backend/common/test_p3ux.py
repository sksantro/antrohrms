"""Notifications, colleague directory and Excel reports."""

from common.models import Notification
from common.testing import Fixture


class NotificationTests(Fixture):
    def test_leave_flow_notifies_both_sides_and_read_state(self):
        c = self.as_user(self.emp)
        rid = c.post("/api/v1/leave/requests", {"category": "CL", "start": "2026-12-01", "end": "2026-12-01", "reason": "Family visit"}, format="json").data["id"]
        self.assertTrue(Notification.objects.filter(user=self.admin).exists())
        self.as_user(self.admin).post(f"/api/v1/admin/leave/requests/{rid}/decision", {"decision": "APPROVE"}, format="json")
        r = c.get("/api/v1/notifications").data
        self.assertEqual(r["unread"], 1)
        self.assertIn("approved", r["items"][0]["title"])
        c.post("/api/v1/notifications", {}, format="json")
        self.assertEqual(c.get("/api/v1/notifications").data["unread"], 0)
        self.assertEqual(self.as_user(self.other).get("/api/v1/notifications").data["items"], [])  # only your own


class DirectoryTests(Fixture):
    def test_everyone_sees_colleagues_without_private_fields(self):
        r = self.as_user(self.emp).get("/api/v1/directory")
        self.assertEqual(r.status_code, 200)
        row = r.data["people"][0]
        self.assertEqual(set(row), {"id", "display_name", "designation", "department", "email", "manager_id", "joined"})
        self.assertNotIn("30000", str(r.content))


class ReportTests(Fixture):
    def test_reports_are_super_admin_only_and_are_excel(self):
        urls = ["/api/v1/admin/reports/attendance?month=2026-10", "/api/v1/admin/reports/leave?year=2026"]
        for u in (self.hr, self.mgr, self.emp):
            for url in urls:
                self.assertEqual(self.as_user(u).get(url).status_code, 403)
        for url in urls:
            r = self.as_user(self.admin).get(url)
            self.assertEqual(r.status_code, 200, url)
            self.assertTrue(r["Content-Type"].startswith("application/vnd.openxmlformats"))
        run = self.as_user(self.admin).post("/api/v1/admin/payroll/runs", {"year": 2026, "month": 10}, format="json").data
        r = self.as_user(self.admin).get(f"/api/v1/admin/reports/salary-register?run={run['id']}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.as_user(self.admin).get("/api/v1/admin/reports/attendance?month=bad").status_code, 422)
