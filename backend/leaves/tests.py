"""Holiday calendar, optional holidays and CL/SL/EL leave (BRD §5, §6, §21)."""
from datetime import date
from decimal import Decimal
from unittest import mock

from attendance.models import AttendanceDay
from common.testing import Fixture
from leaves import services as svc
from leaves.models import LeaveLedger, LeaveRequest

TODAY = date(2026, 11, 2)  # a Monday
FIXED = [("2026-11-09", "Diwali"), ("2026-12-25", "Christmas")]
OPTIONAL = [("2026-11-20", "Opt A"), ("2026-11-27", "Opt B"), ("2026-12-04", "Opt C"), ("2026-12-11", "Opt D")]


class Base(Fixture):
    def setUp(self):
        super().setUp()
        p = mock.patch.object(svc, "today", lambda: TODAY)
        p.start()
        self.addCleanup(p.stop)
        self.c = self.as_user(self.emp)

    def api(self, method, path, body=None, user=None):
        c = self.as_user(user) if user else self.c
        return getattr(c, method)(f"/api/v1/{path}", body, format="json")

    def publish(self, optional=OPTIONAL):
        hr = self.as_user(self.hr)
        cal = hr.post("/api/v1/hr/holidays/drafts?year=2026").data
        hs = [{"date": d, "name": n, "kind": "FIXED"} for d, n in FIXED] + [{"date": d, "name": n, "kind": "OPTIONAL"} for d, n in optional]
        r = hr.put(f"/api/v1/hr/holidays/drafts/{cal['id']}", {"holidays": hs}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        r = hr.post(f"/api/v1/hr/holidays/drafts/{cal['id']}/submit")
        if r.status_code != 200:
            return r
        return self.api("post", f"admin/holidays/{cal['id']}/decision", {"decision": "APPROVE"}, user=self.admin)

    def leave(self, start, end=None, cat="CL", half=False, reason="Family function", user=None):
        return self.api("post", "leave/requests", {"category": cat, "start": start, "end": end or start, "half_day": half, "reason": reason}, user=user)


class CalendarTests(Base):
    def test_hr_drafts_admin_publishes_and_needs_exactly_four_optional(self):
        r = self.publish(optional=OPTIONAL[:3])
        self.assertEqual(r.data["code"], "OPTIONAL_COUNT")
        self.assertEqual(self.publish().data["status"], "PUBLISHED")
        cal = self.c.get("/api/v1/holidays/calendar?year=2026").data
        self.assertEqual((cal["published"], len(cal["holidays"])), (True, 6))

    def test_hr_cannot_publish_and_employee_cannot_draft(self):
        self.assertEqual(self.c.post("/api/v1/hr/holidays/drafts?year=2026").status_code, 403)
        cal = self.as_user(self.hr).post("/api/v1/hr/holidays/drafts?year=2026").data
        r = self.api("post", f"admin/holidays/{cal['id']}/decision", {"decision": "APPROVE"}, user=self.hr)
        self.assertEqual(r.status_code, 403)

    def test_revision_supersedes_and_shows_changes(self):
        self.publish()
        hr = self.as_user(self.hr)
        draft = hr.post("/api/v1/hr/holidays/drafts?year=2026").data
        self.assertEqual((draft["revision"], len(draft["holidays"])), (2, 6))  # copies the published revision
        hs = [h | {"name": "Deepavali"} if h["name"] == "Diwali" else h for h in draft["holidays"]]
        r = hr.put(f"/api/v1/hr/holidays/drafts/{draft['id']}", {"holidays": hs}, format="json")
        self.assertEqual([c["change"] for c in r.data["changes"]], ["CHANGED"])

    def test_two_optional_choices_third_blocked(self):
        self.publish()
        for d in ("2026-11-20", "2026-11-27"):
            self.assertEqual(self.api("post", "holidays/optional-selections", {"date": d}).status_code, 201)
        self.assertEqual(self.api("post", "holidays/optional-selections", {"date": "2026-12-04"}).data["code"], "OPTIONAL_LIMIT")
        self.assertEqual(self.api("post", "holidays/optional-selections", {"date": "2026-11-09"}).data["code"], "NOT_AN_OPTIONAL_HOLIDAY")
        # Unselected options stay workdays for this person; another employee's picks don't affect them.
        self.assertIn(date(2026, 12, 4), svc.working_days(self.emp.employee, date(2026, 12, 4), date(2026, 12, 4)))
        self.assertNotIn(date(2026, 11, 20), svc.working_days(self.emp.employee, date(2026, 11, 20), date(2026, 11, 20)))
        self.assertIn(date(2026, 11, 20), svc.working_days(self.other.employee, date(2026, 11, 20), date(2026, 11, 20)))
        self.assertEqual(self.c.delete("/api/v1/holidays/optional-selections?date=2026-11-20").status_code, 204)

    def test_passed_optional_holiday_cannot_change(self):
        self.publish()
        self.api("post", "holidays/optional-selections", {"date": "2026-11-20"})
        with mock.patch.object(svc, "today", lambda: date(2026, 11, 27)):
            self.assertEqual(self.c.delete("/api/v1/holidays/optional-selections?date=2026-11-20").data["code"], "HOLIDAY_PASSED")
            self.assertEqual(self.api("post", "holidays/optional-selections", {"date": "2026-11-27"}).data["code"], "HOLIDAY_PASSED")


class LeaveTests(Base):
    def balance(self, cat="CL"):
        return self.c.get("/api/v1/leave/balances?year=2026").data["balances"][cat]

    def test_grant_is_prorated_from_joining_month(self):
        # Fixture employees join 31 Jan 2026 → 12 of 12 months for CL 12.
        self.assertEqual(self.balance()["granted"], 12.0)
        self.emp.employee.start_date = date(2026, 7, 1)
        self.emp.employee.save()
        LeaveLedger.objects.all().delete()
        self.assertEqual(self.balance()["granted"], 6.0)
        self.assertEqual(self.balance("EL")["granted"], 7.5)

    def test_weekends_and_holidays_are_not_counted(self):
        self.publish()
        r = self.leave("2026-11-06", "2026-11-10")  # Fri, Sat, Sun, Mon Diwali, Tue
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["days"], Decimal("2.0"))
        self.assertEqual(self.balance()["pending"], 2.0)
        self.assertEqual(self.leave("2026-11-07", "2026-11-08").data["code"], "NO_WORKING_DAYS")

    def test_validation_rules(self):
        self.assertEqual(self.leave("2026-11-10", "2026-11-09").data["code"], "END_BEFORE_START")
        self.assertEqual(self.leave("2026-11-10", "2026-11-11", half=True).data["code"], "HALF_DAY_ONE_DATE")
        self.assertEqual(self.leave("2026-12-31", "2027-01-01").data["code"], "CROSSES_YEAR")
        self.assertEqual(self.leave("2026-09-01").data["code"], "TOO_FAR_BACK")
        self.assertEqual(self.leave("2026-11-10", reason="").data["code"], "REASON_REQUIRED")
        self.assertEqual(self.api("post", "leave/requests", {"category": "LOP", "start": "2026-11-10", "end": "2026-11-10", "reason": "x" * 5}).status_code, 400)
        self.assertEqual(self.leave("2026-11-10", "2026-11-30").data["code"], "INSUFFICIENT_BALANCE")  # 15 days > 12 CL
        self.leave("2026-11-10", "2026-11-12")
        self.assertEqual(self.leave("2026-11-12", "2026-11-13", cat="SL").data["code"], "LEAVE_OVERLAP")

    def test_cannot_take_full_day_leave_on_an_attended_day(self):
        AttendanceDay.objects.create(organization=self.org, employee=self.emp.employee, work_date=date(2026, 10, 30), check_in_at="2026-10-30T04:00:00Z")
        self.assertEqual(self.leave("2026-10-30").data["code"], "ATTENDED_THAT_DAY")
        self.assertEqual(self.leave("2026-10-30", half=True).status_code, 201)

    def test_probation_can_request(self):
        self.assertEqual(self.emp.employee.status, "PROBATION")
        self.assertEqual(self.leave("2026-11-11").status_code, 201)

    def test_only_super_admin_decides_and_ledger_posts_once(self):
        rid = self.leave("2026-11-11", "2026-11-12").data["id"]
        for u in (self.hr, self.mgr, self.emp):
            self.assertEqual(self.api("post", f"admin/leave/requests/{rid}/decision", {"decision": "APPROVE"}, user=u).status_code, 403)
            self.assertEqual(self.api("get", "admin/leave/requests", user=u).status_code, 403)
        r = self.api("post", f"admin/leave/requests/{rid}/decision", {"decision": "APPROVE"}, user=self.admin)
        self.assertEqual(r.data["status"], "APPROVED")
        self.assertEqual(self.api("post", f"admin/leave/requests/{rid}/decision", {"decision": "APPROVE"}, user=self.admin).status_code, 409)
        self.assertEqual(LeaveLedger.objects.filter(source="LEAVE").count(), 1)
        b = self.balance()
        self.assertEqual((b["used"], b["pending"], b["available"]), (2.0, 0.0, 10.0))

    def test_reject_and_needs_changes_require_a_note_then_resubmit(self):
        rid = self.leave("2026-11-11").data["id"]
        url = f"admin/leave/requests/{rid}/decision"
        self.assertEqual(self.api("post", url, {"decision": "REJECT"}, user=self.admin).data["code"], "NOTE_REQUIRED")
        self.assertEqual(self.api("post", url, {"decision": "NEEDS_CHANGES", "note": "Pick SL instead"}, user=self.admin).data["status"], "NEEDS_CHANGES")
        r = self.api("put", f"leave/requests/{rid}", {"category": "SL", "start": "2026-11-11", "end": "2026-11-11", "reason": "Fever"})
        self.assertEqual((r.data["status"], r.data["category"]), ("SUBMITTED", "SL"))

    def test_retrospective_approval_needs_justification(self):
        rid = self.leave("2026-10-28", cat="SL").data["id"]
        url = f"admin/leave/requests/{rid}/decision"
        self.assertEqual(self.api("post", url, {"decision": "APPROVE"}, user=self.admin).data["code"], "JUSTIFICATION_REQUIRED")
        self.assertEqual(self.api("post", url, {"decision": "APPROVE", "note": "Doctor's note seen"}, user=self.admin).data["status"], "APPROVED")

    def test_cancel_rules(self):
        rid = self.leave("2026-11-11").data["id"]
        self.api("post", f"admin/leave/requests/{rid}/decision", {"decision": "APPROVE"}, user=self.admin)
        self.assertEqual(self.api("post", f"leave/requests/{rid}/cancel", user=self.other).status_code, 422)  # not theirs
        self.assertEqual(self.api("post", f"leave/requests/{rid}/cancel").data["status"], "CANCELLED")
        self.assertEqual(self.balance()["available"], 12.0)  # reversed
        rid = self.leave("2026-10-29").data["id"]
        self.api("post", f"admin/leave/requests/{rid}/decision", {"decision": "APPROVE", "note": "ok, seen"}, user=self.admin)
        self.assertEqual(self.api("post", f"leave/requests/{rid}/cancel").data["code"], "LEAVE_STARTED")

    def test_holidays_do_not_debit_leave(self):
        self.publish()
        self.api("post", "holidays/optional-selections", {"date": "2026-11-20"})
        self.assertEqual(self.balance()["available"], 12.0)
        self.assertEqual(LeaveRequest.objects.count(), 0)


class AttendanceIntegrationTests(Base):
    def test_no_check_in_on_a_holiday_or_approved_leave(self):
        from attendance import services as att
        self.publish()
        with mock.patch.object(att, "now", lambda: __import__("datetime").datetime(2026, 11, 9, 10, 0, tzinfo=__import__("zoneinfo").ZoneInfo("Asia/Kolkata"))):
            r = self.api("post", "attendance/check-in", {"mode": "WFO"})
            self.assertEqual(r.data["code"], "DAY_OFF")
            self.assertIn("Diwali", r.data["message"])
        rid = self.leave("2026-11-11").data["id"]
        self.api("post", f"admin/leave/requests/{rid}/decision", {"decision": "APPROVE"}, user=self.admin)
        self.assertEqual(self.api("post", "attendance/wfh-requests", {"date": "2026-11-11", "reason": "Plumber visit"}).data["code"], "DAY_OFF")
