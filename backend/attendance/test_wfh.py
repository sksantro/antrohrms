"""Weekday work from home (owner-approved change, 28 Oct 2026) and the office location checkpoints on resume and check-out."""
from datetime import date, timedelta

from attendance.models import AttendanceDay, PresenceCheck, Proof, WfhRequest
from attendance.tests import AT_DESK, MON, OFFICE, AttendanceBase

AWAY = {"location": {"latitude": OFFICE[0] + 0.02, "longitude": OFFICE[1], "accuracy_m": 15}}  # about 2 km north
PLAN = {"mode": "WFH", "plan": "Finish the payroll export and review two pull requests"}
SUMMARY = "Payroll export merged; reviewed PR #41 and #42"


class WfhBase(AttendanceBase):
    def request_wfh(self, on=MON.date(), reason="Plumber visiting at home", client=None):
        return self.post("wfh-requests", {"date": on.isoformat(), "reason": reason}, client=client)

    def approve(self, request_id, decision="APPROVE"):
        return self.as_user(self.admin).post(f"/api/v1/admin/wfh-requests/{request_id}/decision", {"decision": decision, "note": "OK for today"}, format="json")

    def approved_today(self):
        r = self.request_wfh()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.approve(r.data["id"]).status_code, 200)


class WfhRequestTests(WfhBase):
    def test_wfh_needs_approval_or_an_emergency_reason(self):
        r = self.check_in(**PLAN)
        self.assertEqual(r.data["code"], "WFH_NOT_APPROVED")
        self.request_wfh()
        self.assertEqual(self.check_in(**PLAN).data["code"], "WFH_AWAITING_APPROVAL")
        self.assertFalse(AttendanceDay.objects.exists())

    def test_approved_wfh_day(self):
        self.approved_today()
        r = self.check_in(**PLAN, **AT_DESK)
        self.assertEqual(r.status_code, 201, r.data)
        day = AttendanceDay.objects.get()
        self.assertEqual((day.mode, day.proof, day.review_status), ("WFH", Proof.REMOTE, "PENDING_REVIEW"))  # every WFH day is verified
        self.assertEqual(day.plan, PLAN["plan"])
        self.assertIsNone(day.events.get(type="CHECK_IN").latitude)  # no location collected for home days
        self.assertEqual(day.presence_checks.count(), 3)
        self.assertEqual(r.data["day"]["mode"], "WFH")

    def test_plan_is_required(self):
        self.approved_today()
        r = self.check_in(mode="WFH", plan="")
        self.assertEqual(r.data["code"], "WFH_PLAN_REQUIRED")
        self.assertIn("plan", r.data["field_errors"])

    def test_emergency_wfh_starts_now_and_waits_for_approval(self):
        r = self.check_in(**PLAN, emergency_reason="Child unwell, can't come in")
        self.assertEqual(r.status_code, 201, r.data)
        req = WfhRequest.objects.get()
        self.assertTrue(req.emergency)
        self.assertEqual(req.status, "PENDING")
        self.assertIn("awaiting approval", AttendanceDay.objects.get().proof_note)
        items = self.as_user(self.admin).get("/api/v1/admin/attendance/exceptions").data["items"]
        self.assertTrue(any(i["kind"] == "WFH_REQUEST" and i["emergency"] for i in items))
        self.approve(req.id)
        self.assertEqual(AttendanceDay.objects.get().proof_note, "Work from home")

    def test_monthly_limit_and_date_rules(self):
        mondays = [date(2026, 10, 27), date(2026, 10, 28), date(2026, 10, 29), date(2026, 10, 30)]
        for d in mondays:
            self.assertEqual(self.request_wfh(on=d).status_code, 201)
        r = self.request_wfh(on=date(2026, 10, 26))
        self.assertEqual(r.data["code"], "WFH_MONTHLY_LIMIT")
        self.assertEqual(self.request_wfh(on=date(2026, 11, 2)).status_code, 201)  # next month has its own allowance
        self.assertEqual(self.request_wfh(on=date(2026, 10, 31)).data["code"], "NOT_A_WORKDAY")  # Saturday
        self.assertEqual(self.request_wfh(on=date(2026, 10, 23)).data["code"], "WFH_PAST_DATE")
        self.assertEqual(self.request_wfh(on=date(2026, 11, 2)).status_code, 409)  # already requested
        # An emergency is never blocked by the limit.
        self.assertEqual(self.check_in(**PLAN, emergency_reason="Power cut at the office").status_code, 201)

    def test_only_super_admin_decides_and_people_cancel_their_own(self):
        rid = self.request_wfh(on=date(2026, 10, 27)).data["id"]
        for u in (self.hr, self.mgr, self.emp):
            r = self.as_user(u).post(f"/api/v1/admin/wfh-requests/{rid}/decision", {"decision": "APPROVE", "note": "ok"}, format="json")
            self.assertEqual(r.status_code, 403)
        self.assertEqual(self.post(f"wfh-requests/{rid}/cancel", client=self.as_user(self.other)).status_code, 422)  # not theirs
        self.assertEqual(self.post(f"wfh-requests/{rid}/cancel").data["status"], "CANCELLED")
        self.assertEqual(self.request_wfh(on=date(2026, 10, 27)).status_code, 201)  # can ask again after cancelling


class PresenceCheckTests(WfhBase):
    def setUp(self):
        super().setUp()
        self.approved_today()
        self.check_in(**PLAN)
        self.day = AttendanceDay.objects.get()
        self.checks = list(self.day.presence_checks.all())

    def today(self):
        return self.c.get("/api/v1/attendance/today").data

    def test_checks_are_spread_and_hidden_until_due(self):
        gaps = [(b.due_at - a.due_at).total_seconds() for a, b in zip(self.checks, self.checks[1:])]
        self.assertTrue(all(g >= 3600 for g in gaps), gaps)
        self.assertGreaterEqual(self.checks[0].due_at, MON + timedelta(minutes=45))
        self.assertLessEqual(self.checks[-1].due_at, MON + timedelta(hours=7, minutes=30))
        self.assertIsNone(self.today()["presence"]["due"])
        self.assertEqual(self.today()["presence"]["checks"], [])  # upcoming times aren't revealed

    def test_answer_in_time_and_miss_one(self):
        first, second = self.checks[0], self.checks[1]
        self.clock.t = first.due_at + timedelta(minutes=3)
        due = self.today()["presence"]["due"]
        self.assertEqual(due["id"], str(first.id))
        self.assertEqual(self.post(f"presence-checks/{first.id}/confirm").status_code, 200)
        self.clock.t = second.due_at + timedelta(minutes=11)
        r = self.post(f"presence-checks/{second.id}/confirm")
        self.assertEqual(r.data["code"], "PRESENCE_WINDOW_PASSED")
        p = self.today()["presence"]
        self.assertEqual((p["answered"], p["missed"]), (1, 1))
        self.assertTrue(self.day.events.filter(type="PRESENCE_CONFIRMED").exists())

    def test_a_check_due_during_a_break_moves_to_after_it(self):
        first = self.checks[0]
        self.clock.t = first.due_at - timedelta(minutes=2)
        self.post("break/start", {"kind": "LUNCH"})
        self.clock.t = first.due_at + timedelta(minutes=30)
        self.post("break/resume")
        first.refresh_from_db()
        self.assertEqual(first.status, "PENDING")
        self.assertEqual(first.due_at, self.clock.t + timedelta(minutes=5))

    def test_someone_else_cannot_answer(self):
        self.clock.t = self.checks[0].due_at
        r = self.post(f"presence-checks/{self.checks[0].id}/confirm", client=self.as_user(self.other))
        self.assertEqual(r.status_code, 422)

    def test_checkout_needs_a_summary_and_closes_checks(self):
        self.clock.t = self.checks[0].due_at + timedelta(minutes=20)  # first one missed, others not yet due
        r = self.post("check-out", {"reason": "Leaving early for a test"})
        self.assertEqual(r.data["code"], "WFH_SUMMARY_REQUIRED")
        r = self.post("check-out", {"reason": "Leaving early for a test", "summary": SUMMARY})
        self.assertEqual(r.status_code, 200, r.data)
        statuses = sorted(PresenceCheck.objects.filter(day=self.day).values_list("status", flat=True))
        self.assertEqual(statuses, ["CANCELLED", "CANCELLED", "MISSED"])
        self.day.refresh_from_db()
        self.assertEqual(self.day.summary, SUMMARY)
        items = self.as_user(self.admin).get("/api/v1/admin/attendance/exceptions").data["items"]
        wfh = next(i for i in items if i["kind"] == "WFH_REVIEW")
        self.assertEqual((wfh["presence"]["missed"], wfh["summary"]), (1, SUMMARY))


class OfficeCheckpointTests(WfhBase):
    def test_resume_from_outside_flags_the_day(self):
        with self.office():
            self.check_in(**AT_DESK)
        self.clock.add(60)
        self.post("break/start", {"kind": "TEA"})
        self.clock.add(12)
        r = self.post("break/resume", AWAY)
        self.assertEqual(r.status_code, 200, r.data)
        day = AttendanceDay.objects.get()
        self.assertEqual((day.proof, day.review_status), (Proof.FAILED, "PENDING_REVIEW"))
        self.assertTrue(day.proof_note.startswith("After break"))
        self.assertEqual(r.data["state"], "WORKING")  # time is never blocked

    def test_resume_inside_keeps_the_day_verified(self):
        with self.office():
            self.check_in(**AT_DESK)
        self.clock.add(60)
        self.tea(12)
        day = AttendanceDay.objects.get()
        self.assertEqual((day.proof, day.review_status), (Proof.VERIFIED, "NONE"))
        self.assertTrue(day.events.filter(type="LOCATION_VERIFIED").exists())

    def test_checkout_from_outside_is_allowed_but_flagged(self):
        with self.office():
            self.check_in(**AT_DESK)
        self.clock.to(19, 0)
        r = self.post("check-out", AWAY)
        self.assertEqual(r.data["state"], "CHECKED_OUT")
        day = AttendanceDay.objects.get()
        self.assertEqual(day.proof, Proof.FAILED)
        self.assertTrue(day.proof_note.startswith("Check-out"))
