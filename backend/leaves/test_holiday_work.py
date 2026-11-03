"""Holiday Work (remote only) and Comp-Off (BRD §7, §21)."""
from datetime import date, datetime, timedelta
from unittest import mock

from leaves import holiday_work as hws
from leaves import services as svc
from leaves.models import CompOffLedger, HolidayWork

from .tests import TODAY, Base  # Monday 2 Nov 2026

SAT = "2026-11-07"
RULE = {"active": True, "full_day_hours": 8, "half_day_hours": 4, "expiry_days": 90, "review_note": "Reviewed by counsel on 1 Nov 2026"}


class HWBase(Base):
    def setUp(self):
        super().setUp()
        self.day(TODAY)

    def day(self, d):
        p = mock.patch.object(hws, "today", lambda: d)
        p.start()
        self.addCleanup(p.stop)
        q = mock.patch.object(svc, "today", lambda: d)
        q.start()
        self.addCleanup(q.stop)

    def ask(self, d=SAT, emergency=False, hours=6, **kw):
        return self.api("post", "holiday-work/requests", {"work_date": d, "title": "Release fix", "purpose": "Client go-live needs a hotfix",
                                                           "expected_hours": hours, "emergency": emergency, **kw})

    def act(self, hid, action, body=None, user=None):
        return self.api("post", f"holiday-work/{hid}/{action}", body, user=user)

    def decide(self, hid, decision, note="", hours=None, user=None):
        return self.api("post", f"admin/holiday-work/{hid}/decision", {"decision": decision, "note": note, "hours": hours}, user=user or self.admin)

    def worked(self, hid, hours, d=SAT):
        """Pretend the person worked `hours` on the day and ended work (time can't pass inside a test)."""
        start = datetime.fromisoformat(f"{d}T04:00:00+00:00")
        HolidayWork.objects.filter(pk=hid).update(intervals=[[start.isoformat(), (start + timedelta(hours=hours)).isoformat()]],
                                                  worked_seconds=int(hours * 3600), summary="Shipped the fix", status="AWAITING_REVIEW")

    def rule(self, **kw):
        return self.api("put", "admin/holiday-work/rule", {**RULE, **kw}, user=self.admin)


class RequestTests(HWBase):
    def test_only_weekly_offs_and_holidays_are_eligible(self):
        self.publish()
        eligible = {str(e["date"]) for e in self.c.get("/api/v1/holiday-work/requests").data["eligible"]}
        self.assertIn(SAT, eligible)
        self.assertIn("2026-11-09", eligible)  # Diwali, a Monday
        self.assertNotIn("2026-11-10", eligible)
        self.assertEqual(self.ask("2026-11-10").data["code"], "NOT_A_HOLIDAY")
        self.assertEqual(self.ask("2026-11-09").status_code, 201)

    def test_dates_and_duplicates(self):
        self.assertEqual(self.ask("2026-11-01").data["code"], "DATE_PASSED")
        self.assertEqual(self.ask(SAT, emergency=True).data["code"], "EMERGENCY_TODAY_ONLY")
        self.assertEqual(self.ask("2027-02-06").data["code"], "TOO_FAR_AHEAD")
        self.assertEqual(self.ask(hours=13).data["code"], "INVALID_HOURS")
        self.assertEqual(self.ask(purpose="short").data["code"], "PURPOSE_REQUIRED")
        self.assertEqual(self.ask().status_code, 201)
        self.assertEqual(self.ask().data["code"], "ALREADY_REQUESTED")

    def test_cancel_frees_the_date(self):
        hid = self.ask().data["id"]
        self.assertEqual(self.act(hid, "cancel").data["status"], "CANCELLED")
        self.assertEqual(self.ask().status_code, 201)

    def test_only_super_admin_decides(self):
        hid = self.ask().data["id"]
        self.assertEqual(self.decide(hid, "APPROVE", user=self.hr).status_code, 403)
        self.assertEqual(self.c.get("/api/v1/admin/holiday-work").status_code, 403)
        self.assertEqual(self.decide(hid, "REJECT").data["code"], "NOTE_REQUIRED")
        self.assertEqual(self.decide(hid, "REJECT", "Not needed").data["status"], "REJECTED")
        self.assertEqual(self.act(hid, "start").data["code"], "NOT_STARTABLE")


class WorkAndCreditTests(HWBase):
    def test_full_flow_credits_exactly_once(self):
        hid = self.ask().data["id"]
        self.assertEqual(self.act(hid, "start").data["code"], "NOT_APPROVED")
        self.assertEqual(self.decide(hid, "APPROVE").data["status"], "APPROVED")
        self.assertEqual(self.act(hid, "start").data["code"], "NOT_TODAY")
        self.day(date(2026, 11, 7))
        self.assertTrue(self.act(hid, "start").data["running"])
        self.assertFalse(self.act(hid, "pause").data["running"])
        self.assertEqual(self.act(hid, "pause").data["code"], "NOT_RUNNING")
        self.assertTrue(self.act(hid, "start").data["running"])
        self.assertEqual(self.act(hid, "cancel").data["code"], "NOT_CANCELLABLE")
        self.assertEqual(self.act(hid, "stop", {"summary": "done"}).data["code"], "SUMMARY_REQUIRED")
        r = self.act(hid, "stop", {"summary": "Deployed the hotfix and verified", "task_refs": "PR-12"})
        self.assertEqual((r.data["status"], r.data["running"]), ("AWAITING_REVIEW", False))
        self.worked(hid, 9)
        self.assertEqual(self.decide(hid, "CREDIT", hours=9).data["code"], "LEGAL_RULE_INACTIVE")  # hours alone never credit
        self.assertEqual(self.rule(review_note="").data["code"], "REVIEW_NOTE_REQUIRED")
        self.assertEqual(self.rule().status_code, 200)
        self.assertEqual(self.decide(hid, "CREDIT", hours=9.5).data["code"], "INVALID_HOURS")
        r = self.decide(hid, "CREDIT", hours=9)
        self.assertEqual((r.data["status"], r.data["units"]), ("CREDITED", 1.0))
        self.assertEqual(self.decide(hid, "CREDIT", hours=9).data["code"], "NOT_AWAITING_REVIEW")
        self.assertEqual(CompOffLedger.objects.filter(holiday_work_id=hid, kind="GRANT").count(), 1)
        g = CompOffLedger.objects.get(holiday_work_id=hid)
        self.assertEqual((g.expires_on, g.rule["full_day_hours"]), (date(2027, 2, 5), 8))
        b = self.c.get("/api/v1/holiday-work/requests").data["balance"]
        self.assertEqual((b["granted"], b["available"]), (1.0, 1.0))

    def test_emergency_starts_now_and_half_day_rules(self):
        self.rule()
        self.day(date(2026, 11, 7))
        hid = self.ask(SAT, emergency=True).data["id"]
        self.assertTrue(self.act(hid, "start").data["running"])  # no prior approval needed
        self.worked(hid, 3)
        self.assertEqual(self.decide(hid, "CREDIT", hours=3).data["code"], "UNDER_MINIMUM")
        self.assertEqual(self.decide(hid, "CREDIT", hours=5).data["code"], "INVALID_HOURS")  # more than recorded
        self.assertEqual(self.decide(hid, "NO_CREDIT").data["code"], "NOTE_REQUIRED")
        self.assertEqual(self.decide(hid, "NO_CREDIT", "Under 4 hours").data["status"], "NOT_CREDITED")
        self.assertFalse(CompOffLedger.objects.exists())

    def test_half_day_credit(self):
        self.rule()
        hid = self.ask().data["id"]
        self.decide(hid, "APPROVE")
        self.worked(hid, 5)
        self.assertEqual(self.decide(hid, "CREDIT", hours=5).data["units"], 0.5)


class CompOffLeaveTests(HWBase):
    def grant(self, hours=8, d=SAT):
        self.rule()
        hid = self.ask(d).data["id"]
        self.decide(hid, "APPROVE")
        self.worked(hid, hours, d)
        self.assertEqual(self.decide(hid, "CREDIT", hours=hours).status_code, 200)

    def test_use_and_cancel_restores(self):
        self.assertEqual(self.leave("2026-11-12", cat="CO").data["code"], "INSUFFICIENT_BALANCE")
        self.grant()
        self.assertEqual(self.leave("2026-11-12", "2026-11-13", cat="CO").data["code"], "INSUFFICIENT_BALANCE")
        lid = self.leave("2026-11-12", cat="CO").data["id"]
        self.assertEqual(self.leave("2026-11-16", cat="CO").data["code"], "INSUFFICIENT_BALANCE")  # held by the pending one
        self.assertEqual(self.api("post", f"admin/leave/requests/{lid}/decision", {"decision": "APPROVE"}, user=self.admin).status_code, 200)
        b = self.c.get("/api/v1/leave/balances?year=2026").data["balances"]["CO"]
        self.assertEqual((b["used"], b["available"]), (1.0, 0.0))
        self.assertEqual(self.api("post", f"leave/requests/{lid}/cancel").data["status"], "CANCELLED")
        b = self.c.get("/api/v1/leave/balances?year=2026").data["balances"]["CO"]
        self.assertEqual((b["used"], b["available"]), (0.0, 1.0))
        self.assertEqual(CompOffLedger.objects.filter(kind="RESTORE").count(), 1)

    def test_expired_comp_off_cannot_be_used(self):
        self.grant()
        CompOffLedger.objects.update(expires_on=date(2026, 11, 10))
        self.assertEqual(self.leave("2026-11-12", cat="CO").data["code"], "INSUFFICIENT_BALANCE")
        self.assertEqual(self.leave("2026-11-10", cat="CO").status_code, 201)

    def test_cl_balances_unaffected(self):
        self.grant()
        b = self.c.get("/api/v1/leave/balances?year=2026").data["balances"]
        self.assertEqual(b["CL"]["granted"], 12.0)
        self.assertNotIn("CO", [x.category for x in svc.LeaveLedger.objects.all()])


class AttendanceMessageTests(HWBase):
    def test_weekend_check_in_points_to_holiday_work(self):
        self.assertTrue(hws.day_label(self.emp.employee, date(2026, 11, 8)).startswith("Weekly off"))
        self.assertIsNone(hws.day_label(self.emp.employee, TODAY))
