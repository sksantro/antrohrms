"""Attendance rules — BRD §21.1 examples plus geofence, corrections and access control."""
from contextlib import contextmanager
from datetime import datetime, timedelta
from decimal import Decimal
from unittest import mock
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from attendance import services as svc
from attendance.models import AttendanceDay, AttendanceEvent, Proof
from common.models import OfficeSite
from common.testing import Fixture

IST = ZoneInfo("Asia/Kolkata")
MON = datetime(2026, 10, 26, 9, 30, tzinfo=IST)  # a Monday
OFFICE = (17.4400, 78.3800)  # synthetic test coordinates, not a real office


class Clock:
    def __init__(self, start):
        self.t = start

    def __call__(self):
        return self.t

    def to(self, hh, mm, day=MON):
        self.t = day.replace(hour=hh, minute=mm)

    def add(self, minutes):
        self.t += timedelta(minutes=minutes)


class AttendanceBase(Fixture):
    def setUp(self):
        super().setUp()
        self.clock = Clock(MON)
        patcher = mock.patch.object(svc, "now", self.clock)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.c = self.as_user(self.emp)

    def post(self, path, body=None, client=None, **headers):
        return (client or self.c).post(f"/api/v1/attendance/{path}", body or {}, format="json", **headers)

    def check_in(self, **body):
        return self.post("check-in", body)

    def tea(self, minutes):
        self.post("break/start", {"kind": "TEA"})
        self.clock.add(minutes)
        self.post("break/resume")

    @contextmanager
    def office(self, radius=50):
        OfficeSite.objects.create(organization=self.org, name="HQ", latitude=Decimal(str(OFFICE[0])), longitude=Decimal(str(OFFICE[1])), radius_m=radius)
        yield


class PunchRulesTests(AttendanceBase):
    def test_check_in_once_then_409(self):
        r = self.check_in()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["state"], "WORKING")
        again = self.check_in()
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.data["code"], "ALREADY_CHECKED_IN")

    def test_weekend_is_not_a_workday(self):
        self.clock.t = MON + timedelta(days=5)  # Saturday
        r = self.check_in()
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.data["code"], "NOT_A_WORKDAY")

    def test_unlimited_tea_and_no_lunch_during_tea(self):
        self.check_in()
        for _ in range(6):
            self.clock.add(30)
            self.tea(12)
        self.post("break/start", {"kind": "TEA"})
        r = self.post("break/start", {"kind": "LUNCH"})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.c.get("/api/v1/attendance/today").data["tea_count"], 7)

    def test_brd_example_full_day_is_compliant(self):
        """09:30–19:00: 45m lunch + 3×15m tea = 90m breaks → exactly 8h work, 9h30m presence."""
        with self.office():
            self.check_in(location={"latitude": OFFICE[0], "longitude": OFFICE[1], "accuracy_m": 10})
        self.clock.to(11, 0); self.tea(15)
        self.clock.to(13, 0); self.post("break/start", {"kind": "LUNCH"}); self.clock.add(45); self.post("break/resume")
        self.clock.to(15, 30); self.tea(15)
        self.clock.to(17, 0); self.tea(15)
        self.clock.to(19, 0)
        r = self.post("check-out")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["work_seconds"], r.data["presence_seconds"]), (8 * 3600, 9 * 3600 + 1800))
        self.assertEqual(r.data["tea_seconds"] + r.data["lunch_seconds"], 90 * 60)
        self.assertEqual(r.data["day"]["review_status"], "NONE")

    def test_early_checkout_needs_reason_then_goes_to_review(self):
        self.check_in()
        self.clock.to(16, 0)
        r = self.post("check-out")
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.data["code"], "SHORTFALL_REASON_REQUIRED")
        r = self.post("check-out", {"reason": "Doctor's appointment"})
        self.assertEqual(r.data["state"], "CHECKED_OUT")
        self.assertEqual(r.data["day"]["review_status"], "PENDING_REVIEW")

    def test_nine_hours_presence_but_under_eight_work_is_shortfall(self):
        self.check_in()
        self.clock.to(12, 0); self.post("break/start", {"kind": "LUNCH"}); self.clock.add(70); self.post("break/resume")
        self.clock.to(18, 30)  # presence 9h, work 7h50m
        self.assertEqual(self.post("check-out").data["code"], "SHORTFALL_REASON_REQUIRED")

    def test_eight_hours_work_but_under_nine_presence_is_shortfall(self):
        self.check_in()
        self.clock.to(17, 45)  # 8h15m work, 8h15m presence
        self.assertEqual(self.post("check-out").data["code"], "SHORTFALL_REASON_REQUIRED")

    def test_checkout_during_break_closes_it(self):
        self.check_in()
        self.clock.to(13, 0)
        self.post("break/start", {"kind": "LUNCH"})
        self.clock.to(13, 20)
        r = self.post("check-out", {"reason": "Emergency at home"})
        self.assertEqual((r.data["state"], r.data["lunch_seconds"]), ("CHECKED_OUT", 20 * 60))

    def test_client_supplied_times_are_ignored(self):
        r = self.check_in(at="2020-01-01T00:00:00Z", work_seconds=99999)
        self.assertEqual(r.data["day"]["check_in_at"], MON)
        self.assertEqual(r.data["work_seconds"], 0)

    def test_idempotency_key_prevents_duplicates(self):
        self.check_in()
        for _ in range(3):
            self.post("break/start", {"kind": "TEA"}, HTTP_IDEMPOTENCY_KEY="tea-1")
        self.assertEqual(AttendanceEvent.objects.filter(type="START_TEA").count(), 1)

    def test_previous_day_left_open(self):
        self.check_in()
        self.clock.t = MON + timedelta(days=1)  # Tuesday
        r = self.check_in()
        self.assertEqual((r.status_code, r.data["code"]), (409, "PREVIOUS_DAY_OPEN"))
        self.assertTrue(self.c.get("/api/v1/attendance/today").data["day"]["stale"])
        self.assertEqual(self.post("check-out").data["code"], "SHORTFALL_REASON_REQUIRED")
        self.post("check-out", {"reason": "Forgot to check out yesterday"})
        self.assertEqual(self.check_in().status_code, 201)

    def test_events_are_append_only(self):
        self.check_in()
        ev = AttendanceEvent.objects.get()
        with self.assertRaises(RuntimeError):
            ev.note = "edited"
            ev.save()
        with self.assertRaises(RuntimeError):
            ev.delete()


class GeofenceUnitTests(SimpleTestCase):
    site = OfficeSite(latitude=Decimal("17.44"), longitude=Decimal("78.38"), radius_m=50)

    def at(self, north_m, acc):
        return svc.Location(17.44 + north_m / 111_195, 78.38, acc)

    def test_outcomes(self):
        self.assertEqual(svc.evaluate_location(self.site, self.at(10, 15))[0], Proof.VERIFIED)
        self.assertEqual(svc.evaluate_location(self.site, self.at(40, 30))[0], Proof.INCONCLUSIVE)  # 40+30 > 50, 40-30 < 50
        self.assertEqual(svc.evaluate_location(self.site, self.at(500, 20))[0], Proof.FAILED)
        self.assertEqual(svc.evaluate_location(self.site, None, "permission denied")[0], Proof.INCONCLUSIVE)
        self.assertEqual(svc.evaluate_location(OfficeSite(radius_m=50), self.at(0, 5))[0], Proof.INCONCLUSIVE)


class GeofenceApiTests(AttendanceBase):
    def test_verified_check_in_needs_no_review(self):
        with self.office():
            r = self.check_in(location={"latitude": OFFICE[0], "longitude": OFFICE[1], "accuracy_m": 12})
        self.assertEqual((r.data["day"]["proof"], r.data["day"]["review_status"]), ("VERIFIED", "NONE"))
        self.assertNotIn("latitude", str(r.data))  # coordinates never echoed to the employee

    def test_denied_location_still_checks_in_but_needs_review(self):
        with self.office():
            r = self.check_in(location_error="permission denied")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["day"]["proof"], "INCONCLUSIVE")
        items = self.as_user(self.admin).get("/api/v1/admin/attendance/exceptions").data["items"]
        self.assertEqual([i["kind"] for i in items], ["GEO_INCONCLUSIVE"])

    def test_admin_accepts_proof_after_manual_check(self):
        with self.office():
            day_id = self.check_in(location={"latitude": 17.50, "longitude": 78.38, "accuracy_m": 10}).data["day"]["id"]
        self.assertEqual(AttendanceDay.objects.get().proof, "FAILED")
        r = self.as_user(self.admin).post(f"/api/v1/admin/attendance/days/{day_id}/review", {"action": "ACCEPT_PROOF", "note": "Seen at desk"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(AttendanceDay.objects.get().proof, "ADMIN_OVERRIDE")
        self.assertEqual(self.as_user(self.admin).get("/api/v1/admin/attendance/exceptions").data["items"], [])

    def test_accepting_location_keeps_early_checkout_review(self):
        day_id = self.check_in(location_error="permission denied").data["day"]["id"]
        self.clock.to(15, 0)
        self.post("check-out", {"reason": "Left early"})
        admin = self.as_user(self.admin)
        admin.post(f"/api/v1/admin/attendance/days/{day_id}/review", {"action": "ACCEPT_PROOF", "note": "Seen at desk"}, format="json")
        kinds = [i["kind"] for i in admin.get("/api/v1/admin/attendance/exceptions").data["items"]]
        self.assertEqual(kinds, ["SHORTFALL"])
        admin.post(f"/api/v1/admin/attendance/days/{day_id}/review", {"action": "ACKNOWLEDGE", "note": "Approved by me"}, format="json")
        self.assertEqual(admin.get("/api/v1/admin/attendance/exceptions").data["items"], [])

    def test_failed_reverification_flags_day_without_changing_time(self):
        with self.office():
            self.check_in(location={"latitude": OFFICE[0], "longitude": OFFICE[1], "accuracy_m": 10})
            self.clock.add(15)
            r = self.post("verify-location", {"location": {"latitude": 17.6, "longitude": 78.38, "accuracy_m": 10}})
        self.assertEqual((r.data["day"]["proof"], r.data["work_seconds"]), ("INCONCLUSIVE", 15 * 60))


class CorrectionTests(AttendanceBase):
    def stale_day(self):
        day_id = self.check_in().data["day"]["id"]
        self.clock.t = MON + timedelta(days=1, hours=1)
        return day_id

    def test_missed_checkout_correction_flow(self):
        day_id = self.stale_day()
        r = self.c.post(f"/api/v1/attendance/days/{day_id}/corrections", {"event_type": "CHECK_OUT", "proposed_at": "2026-10-26T18:45:00+05:30", "reason": "Forgot to punch out"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        cid = r.data["id"]
        self.assertEqual(self.as_user(self.hr).post(f"/api/v1/admin/attendance/corrections/{cid}/decision", {"decision": "APPROVE", "note": "ok"}, format="json").status_code, 403)
        r = self.as_user(self.admin).post(f"/api/v1/admin/attendance/corrections/{cid}/decision", {"decision": "APPROVE", "note": "Confirmed with team"}, format="json")
        self.assertEqual(r.data["status"], "APPROVED")
        day = AttendanceDay.objects.get(pk=day_id)
        self.assertEqual((day.status, day.work_seconds), ("CLOSED", 9 * 3600 + 15 * 60))
        self.assertTrue(AttendanceEvent.objects.filter(type="CORRECTION_APPROVED").exists())
        again = self.as_user(self.admin).post(f"/api/v1/admin/attendance/corrections/{cid}/decision", {"decision": "REJECT", "note": "x" * 3}, format="json")
        self.assertEqual(again.data["code"], "ALREADY_DECIDED")

    def test_impossible_correction_is_rejected_on_approval(self):
        day_id = self.stale_day()
        cid = self.c.post(f"/api/v1/attendance/days/{day_id}/corrections", {"event_type": "END_TEA", "proposed_at": "2026-10-26T12:00:00+05:30", "reason": "Missed resume"}, format="json").data["id"]
        r = self.as_user(self.admin).post(f"/api/v1/admin/attendance/corrections/{cid}/decision", {"decision": "APPROVE", "note": "try"}, format="json")
        self.assertEqual(r.data["code"], "INVALID_SEQUENCE")

    def test_cannot_correct_someone_elses_day(self):
        day_id = self.stale_day()
        r = self.as_user(self.other).post(f"/api/v1/attendance/days/{day_id}/corrections", {"event_type": "CHECK_OUT", "proposed_at": "2026-10-26T18:00:00+05:30", "reason": "Not mine"}, format="json")
        self.assertEqual(r.status_code, 422)  # NOT_FOUND: other people's days are invisible


class AdminAccessTests(AttendanceBase):
    def test_only_super_admin_sees_live_board_and_evidence(self):
        day_id = self.check_in().data["day"]["id"]
        for u in (self.hr, self.mgr, self.emp):
            c = self.as_user(u)
            self.assertEqual(c.get("/api/v1/admin/attendance/today").status_code, 403)
            self.assertEqual(c.get(f"/api/v1/admin/attendance/days/{day_id}").status_code, 403)
            self.assertEqual(c.get("/api/v1/admin/office-site").status_code, 403)
        board = self.as_user(self.admin).get("/api/v1/admin/attendance/today").data
        self.assertEqual(board["counts"]["WORKING"], 1)
        self.assertEqual(board["counts"]["NOT_ARRIVED"], 4)

    def test_admin_sets_office_location_with_audit(self):
        r = self.as_user(self.admin).patch("/api/v1/admin/office-site", {"latitude": "17.440000", "longitude": "78.380000", "radius_m": 60}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["radius_m"], 60)
        bad = self.as_user(self.admin).patch("/api/v1/admin/office-site", {"radius_m": 5}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_history_shows_only_own_days(self):
        self.check_in()
        self.post("check-in", client=self.as_user(self.other))
        r = self.c.get("/api/v1/attendance/history?month=2026-10")
        self.assertEqual(len(r.data["days"]), 1)
