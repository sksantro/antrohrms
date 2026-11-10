"""End-to-end: one person from candidate to exit through every module, via the real API and each role (BRD §2.1).

Runs on a fixed simulated calendar so it never depends on today's date. Synthetic data only.
"""
import re
from datetime import datetime, timedelta
from decimal import Decimal
from unittest import mock
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from common.models import NotificationOutbox
from common.testing import Fixture
from employees.models import Employee

IST = ZoneInfo("Asia/Kolkata")
OFFICE = {"latitude": "17.440000", "longitude": "78.380000"}
AT_DESK = {"location": {"latitude": 17.44, "longitude": 78.38, "accuracy_m": 10}}
NEW_PASSWORD = "Lifecycle-Test-Pass-91"  # synthetic, test-only


class Clock:
    def __init__(self):
        self.t = datetime(2026, 11, 10, 10, 0, tzinfo=IST)  # a Tuesday

    def __call__(self):
        return self.t

    def to(self, y, m, d, hh=10, mm=0):
        self.t = datetime(y, m, d, hh, mm, tzinfo=IST)


class LifecycleTest(Fixture):
    def setUp(self):
        super().setUp()
        self.clock = Clock()
        p = mock.patch("django.utils.timezone.now", self.clock)
        p.start()
        self.addCleanup(p.stop)

    def call(self, user, method, path, body=None, fmt="json", ok=(200, 201)):
        c = APIClient()
        if user is not None:
            c.force_authenticate(user=user)
        r = getattr(c, method)(f"/api/v1/{path}", body, format=fmt)
        self.assertIn(r.status_code, ok, f"{method.upper()} {path} → {r.status_code} {getattr(r, 'data', '')}")
        return r.data

    def mail(self, key_contains, pattern):
        body = NotificationOutbox.objects.filter(dedupe_key__contains=key_contains).latest("created_at").body
        return re.search(pattern, body).group(1)

    def test_hire_to_exit(self):
        admin, hr, mgr = self.admin, self.hr, self.mgr
        A, H = (lambda *a, **k: self.call(admin, *a, **k)), (lambda *a, **k: self.call(hr, *a, **k))
        self.call(admin, "patch", "admin/office-site", {**OFFICE, "radius_m": 100})

        # ---- P3a recruitment ----
        c = H("post", "hr/candidates", {"name": "Lifecycle Person", "email": "life@example.test", "phone": "9800000001", "role_applied": "Software Engineer", "template_code": "DEVELOPER"})
        rnd = H("post", f"hr/candidates/{c['id']}/interviews", {"kind": "TECHNICAL", "scheduled_at": "2026-11-11T11:00:00+05:30", "mode": "ONLINE",
                                                                "meeting_url": "https://meet.example.test/x", "interviewers": [str(self.emp.employee.id)]})
        self.clock.to(2026, 11, 11, 12)
        answers = [{"key": k, "evaluation": "GOOD", "rating": 4, "remark": "Clear reasoning with examples"} for k in ("coding", "js_react", "problem_solving", "quality", "collaboration")]
        self.call(self.emp, "post", f"interviews/{rnd['id']}/feedback", {"answers": answers, "overall": "RECOMMENDED", "submit": True})
        self.assertEqual(A("post", f"admin/candidates/{c['id']}/decision", {"decision": "SELECT"})["stage"], "SELECTED")
        offer = H("post", f"hr/candidates/{c['id']}/offer", {"designation": "Software Engineer", "department": str(self.dept.id), "joining_date": "2026-11-16",
                                                             "work_location": "Hyderabad office", "reporting_manager": str(mgr.employee.id)})
        H("post", f"hr/offers/{offer['id']}/submit")
        self.assertEqual(A("post", f"admin/offers/{offer['id']}/decision", {"decision": "APPROVE", "monthly_gross": "40000"})["status"], "SENT")
        token = self.mail(f"offer-sent:{offer['id']}", r"/candidate/offer/(\S+)")
        self.assertEqual(self.call(None, "post", f"candidate/offers/{token}", {"decision": "ACCEPT", "signed_name": "Lifecycle Person", "consent": True})["status"], "ACCEPTED")

        # ---- P3b onboarding ----
        H("post", f"hr/onboarding/{c['id']}/request-documents", {"categories": ["EDUCATION"]})
        link = self.mail("docs-link", r"/candidate/documents/(\S+)")
        self.call(None, "post", f"candidate/portal/{link}/otp")
        code = re.search(r"(\d{6})", NotificationOutbox.objects.filter(template_key="otp").latest("created_at").subject).group(1)
        session = self.call(None, "post", f"candidate/portal/{link}/verify", {"code": code})["session"]
        from django.core.files.uploadedfile import SimpleUploadedFile
        r = APIClient().post("/api/v1/candidate/portal/session", {"category": "EDUCATION", "file": SimpleUploadedFile("deg.pdf", b"%PDF-1.4 synthetic")}, format="multipart", HTTP_X_PORTAL_SESSION=session)
        self.assertEqual(r.status_code, 201, r.data)
        doc = r.data["items"][0]["document"]["id"]
        H("post", f"hr/documents/{doc}/review", {"status": "VERIFIED"})
        self.clock.to(2026, 11, 16, 9, 0)  # joining day, a Monday
        joined = H("post", f"hr/onboarding/{c['id']}/join", {"official_email": "life@antro.test"})
        self.assertTrue(joined["employee_code"])
        invite = self.mail("invite:", r"activate\?token=(\S+)")
        self.call(None, "post", "auth/activate", {"token": invite, "password": NEW_PASSWORD, "accept_policy": True})
        login = APIClient().post("/api/v1/auth/login", {"email": "life@antro.test", "password": NEW_PASSWORD}, format="json")
        self.assertEqual(login.status_code, 200, login.data)
        me = User.objects.get(email="life@antro.test")
        emp = me.employee
        self.assertEqual((emp.status, emp.reporting_manager_id), ("PROBATION", mgr.employee.id))
        appt = A("get", "admin/letters")["letters"][0]
        A("post", f"admin/letters/{appt['id']}/decision", {"decision": "APPROVE"})
        self.assertIn("₹40,000.00", self.call(me, "get", "documents/me")["letters"][0]["content"])

        # ---- P1 attendance (office day) ----
        self.clock.to(2026, 11, 16, 9, 30)
        self.call(me, "post", "attendance/check-in", AT_DESK)
        self.clock.to(2026, 11, 16, 11, 0)
        self.call(me, "post", "attendance/break/start", {"kind": "TEA"})
        self.clock.to(2026, 11, 16, 11, 10)
        self.call(me, "post", "attendance/break/resume", AT_DESK)
        self.clock.to(2026, 11, 16, 18, 45)
        self.call(me, "post", "attendance/check-out", AT_DESK)
        from attendance.models import AttendanceDay
        d = AttendanceDay.objects.get(employee=emp, work_date="2026-11-16")
        self.assertEqual((d.status, d.mode), ("CLOSED", "WFO"))
        self.assertGreaterEqual(d.work_seconds, 9 * 3600 - 15 * 60)  # 09:30–18:45 less a 10-minute tea break

        # ---- P2 leave and holiday work ----
        lv = self.call(me, "post", "leave/requests", {"category": "CL", "start": "2026-11-18", "end": "2026-11-18", "half_day": False, "reason": "Family function"})
        self.assertEqual(A("post", f"admin/leave/requests/{lv['id']}/decision", {"decision": "APPROVE"})["status"], "APPROVED")
        hw = self.call(me, "post", "holiday-work/requests", {"work_date": "2026-11-21", "title": "Release", "purpose": "Client go-live needs support", "expected_hours": 8})
        A("post", f"admin/holiday-work/{hw['id']}/decision", {"decision": "APPROVE"})
        self.clock.to(2026, 11, 21, 9, 0)
        self.call(me, "post", f"holiday-work/{hw['id']}/start")
        self.clock.to(2026, 11, 21, 17, 30)
        self.call(me, "post", f"holiday-work/{hw['id']}/stop", {"summary": "Deployed and monitored the release"})
        A("put", "admin/holiday-work/rule", {"active": True, "full_day_hours": 8, "half_day_hours": 4, "expiry_days": 90, "review_note": "Reviewed by counsel, Nov 2026"})
        self.assertEqual(A("post", f"admin/holiday-work/{hw['id']}/decision", {"decision": "CREDIT", "hours": 8.5})["units"], 1.0)
        self.assertEqual(self.call(me, "get", "leave/balances?year=2026")["balances"]["CO"]["available"], 1.0)

        # ---- P2 payroll ----
        self.clock.to(2026, 12, 1, 10)
        run = A("post", "admin/payroll/runs", {"year": 2026, "month": 11})
        slip = next(s for s in A("get", f"admin/payroll/runs/{run['id']}")["payslips"] if s["employee_id"] == str(emp.id))
        self.assertEqual(Decimal(str(slip["gross"])), Decimal("20000.00"))  # 15 of 30 days from 16 Nov
        A("post", f"admin/payroll/runs/{run['id']}/approve")
        self.assertEqual(len(self.call(me, "get", "payslips/me")["payslips"]), 1)

        # ---- P3b probation ----
        self.clock.to(2027, 2, 5, 10)
        rv = H("post", f"hr/probation/{emp.id}/review", {"recommendation": "CONFIRM", "note": "Consistent delivery and attendance"})
        A("post", f"admin/probation/{rv['id']}/decision", {"decision": "CONFIRM"})
        self.assertEqual(Employee.objects.get(pk=emp.pk).status, "ACTIVE_CONFIRMED")

        # ---- P4 asset ----
        asset = H("post", "hr/assets", {"category": "LAPTOP", "make_model": "ThinkPad", "tag": "LIFE-1"})
        al = H("post", f"hr/assets/{asset['id']}/assign", {"employee": str(emp.id)})
        self.call(me, "post", f"allocations/{al['id']}/acknowledge", {"typed": "LIFE-1"})

        # ---- P5 appraisal (first anniversary 16 Nov 2027; opens 30 days before) ----
        self.clock.to(2027, 10, 20, 10)
        review = self.call(me, "get", "appraisal/me")["reviews"][0]
        ans = [{"key": q["key"], "rating": 4 if q["rated"] else None, "text": "Shipped two modules with good test coverage"} for q in review["questions"]]
        self.call(me, "post", f"appraisal/{review['id']}/self", {"answers": ans, "submit": True})
        self.call(mgr, "post", f"manager/reviews/{review['id']}/save", {"answers": ans, "comments": "Reliable and improving fast", "recommendation": "INCREMENT"})
        self.call(mgr, "post", f"manager/reviews/{review['id']}/meeting", {"meeting_date": "2027-10-20", "strengths": "Ownership and quality", "development_plan": "Lead a feature next year"})
        self.call(me, "post", f"appraisal/{review['id']}/acknowledge", {"comments": "Agreed"})
        self.call(mgr, "post", f"manager/reviews/{review['id']}/complete")
        A("post", f"admin/appraisals/{review['id']}/decision", {"decision": "APPROVE", "final_rating": 4.0, "new_gross": "46000", "effective_date": "2027-11-16"})
        self.assertTrue(emp.salary_versions.filter(effective_from="2027-11-16", monthly_gross=Decimal("46000")).exists())

        # ---- P4 resignation, exit, F&F ----
        self.clock.to(2027, 11, 20, 10)
        res = self.call(me, "post", "resignation/me", {"reason": "Relocating to another city", "proposed_last_day": "2027-12-20"})
        A("post", f"admin/resignations/{res['id']}/decision", {"decision": "ACCEPT"})
        ex = H("get", "hr/exits")["exits"][0]
        for k in ("handover", "documents", "it_access", "attendance"):
            H("post", f"hr/exits/{ex['id']}/checklist", {"key": k, "done": True})
        H("post", f"hr/allocations/{al['id']}/return-start")
        H("post", f"hr/allocations/{al['id']}/return", {"condition": "GOOD"})
        self.call(me, "post", f"allocations/{al['id']}/confirm-return", {"agrees": True})
        st = A("get", f"admin/exits/{ex['id']}/settlement")["settlement"]
        self.assertGreater(Decimal(str(st["net"])), 0)
        A("post", f"admin/exits/{ex['id']}/settlement/approve")
        for x in H("get", "hr/letters?status=DRAFT")["letters"]:
            if x["employee"]["id"] == str(emp.id):
                H("post", f"hr/letters/{x['id']}/submit")
                A("post", f"admin/letters/{x['id']}/decision", {"decision": "APPROVE"})
        self.clock.to(2027, 12, 21, 10)
        self.assertEqual(H("post", f"hr/exits/{ex['id']}/complete")["status"], "COMPLETED")
        self.assertEqual(Employee.objects.get(pk=emp.pk).status, "EXITED")
        blocked = APIClient().post("/api/v1/auth/login", {"email": "life@antro.test", "password": NEW_PASSWORD}, format="json")
        self.assertNotEqual(blocked.status_code, 200)
        kinds = set(emp.letters.filter(status="RELEASED").values_list("kind", flat=True))
        self.assertEqual(kinds, {"APPOINTMENT", "PROBATION_CONFIRMATION", "SALARY_REVISION", "RESIGNATION_ACCEPTANCE", "FNF_STATEMENT", "EXPERIENCE", "RELIEVING"})
        self.assertEqual(timezone.localdate().isoformat(), "2027-12-21")
