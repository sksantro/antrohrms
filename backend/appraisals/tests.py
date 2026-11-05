"""Anniversary appraisal (BRD §13, §21). Synthetic data only."""
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from appraisals import services as svc
from appraisals.models import Review
from common.testing import Fixture
from employees.models import Employee
from onboarding.models import Letter

WINDOW = date(2027, 1, 5)  # emp joined 31 Jan 2026: first review due 31 Jan 2027, open from 1 Jan


class Base(Fixture):
    def setUp(self):
        super().setUp()
        self.at(WINDOW)

    def at(self, d):
        p = mock.patch.object(svc, "today", lambda: d)
        p.start()
        self.addCleanup(p.stop)

    def api(self, method, path, body=None, user=None):
        return getattr(self.as_user(user or self.emp), method)(f"/api/v1/{path}", body, format="json")

    def review(self) -> Review:
        self.api("get", "appraisal/me")
        return Review.objects.get(employee=self.emp.employee)

    def answers(self, r, **over):
        out = []
        for q in r.questions:
            a = {"key": q["key"], "rating": 4 if q["rated"] else None, "text": "Delivered the billing module on time with tests"}
            out.append({**a, **over.get(q["key"], {})})
        return out

    def submitted(self):
        r = self.review()
        self.assertEqual(self.api("post", f"appraisal/{r.id}/self", {"answers": self.answers(r), "submit": True}).data["status"], "SELF_SUBMITTED")
        return r

    def completed(self):
        r = self.submitted()
        self.api("post", f"manager/reviews/{r.id}/save", {"answers": self.answers(r), "comments": "Strong year with steady delivery", "recommendation": "BOTH"}, user=self.mgr)
        self.api("post", f"manager/reviews/{r.id}/meeting", {"meeting_date": str(WINDOW), "strengths": "Ownership and quality", "development_plan": "Lead a small project"}, user=self.mgr)
        self.api("post", f"appraisal/{r.id}/acknowledge", {"comments": "Agreed"})
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/complete", user=self.mgr).data["status"], "MANAGER_COMPLETED")
        return r


class OpeningTests(Base):
    def test_opens_30_days_before_anniversary_only_once(self):
        self.at(date(2026, 12, 20))
        self.assertEqual(self.api("get", "appraisal/me").data["reviews"], [])
        self.at(WINDOW)
        r = self.api("get", "appraisal/me").data["reviews"]
        self.assertEqual((len(r), r[0]["due_date"], r[0]["template_code"]), (1, date(2027, 1, 31), "DEVELOPER"))  # designation "Engineer"
        self.api("get", "appraisal/me")
        self.assertEqual(Review.objects.filter(employee=self.emp.employee).count(), 1)

    def test_template_mapping(self):
        self.assertEqual([svc.template_for(d) for d in ("Senior Software Engineer", "Pre-Sales Consultant", "Sales Manager", "UI/UX Designer", "HR Executive", "Accountant")],
                         ["DEVELOPER", "PRESALES", "SALES", "DESIGN", "HR", "GENERAL"])

    def test_admin_can_open_early_but_not_twice_or_on_notice(self):
        self.at(date(2026, 11, 5))
        r = self.api("post", "admin/appraisals", {"employee": str(self.other.employee.id)}, user=self.admin)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.api("post", "admin/appraisals", {"employee": str(self.other.employee.id)}, user=self.admin).data["code"], "REVIEW_EXISTS")
        Employee.objects.filter(pk=self.emp.employee.pk).update(status="NOTICE_PERIOD")
        self.assertEqual(self.api("post", "admin/appraisals", {"employee": str(self.emp.employee.id)}, user=self.admin).data["code"], "NOT_ELIGIBLE")
        self.assertEqual(self.api("post", "admin/appraisals", {"employee": str(self.other.employee.id)}, user=self.hr).status_code, 403)


class SelfReviewTests(Base):
    def test_validation_and_lock(self):
        r = self.review()
        self.assertEqual(self.api("post", f"appraisal/{r.id}/self", {"answers": [], "submit": False}, user=self.other).data["code"], "NOT_FOUND")
        k = r.questions[0]["key"]
        self.assertEqual(self.api("post", f"appraisal/{r.id}/self", {"answers": self.answers(r, **{k: {"rating": 7}}), "submit": False}).data["code"], "INVALID_RATING")
        self.assertEqual(self.api("post", f"appraisal/{r.id}/self", {"answers": self.answers(r)[:3], "submit": True}).data["code"], "ANSWER_REQUIRED")
        self.assertEqual(self.api("post", f"appraisal/{r.id}/self", {"answers": self.answers(r, **{k: {"text": "ok"}}), "submit": True}).data["code"], "JUSTIFICATION_REQUIRED")
        self.api("post", f"appraisal/{r.id}/self", {"answers": self.answers(r)[:2], "submit": False})
        self.assertEqual(self.api("get", "manager/reviews", user=self.mgr).data["reviews"][0]["self_answers"], [])  # manager can't read a draft
        na = self.answers(r, **{k: {"rating": None, "text": ""}})
        res = self.api("post", f"appraisal/{r.id}/self", {"answers": na, "submit": True})
        self.assertEqual(res.data["status"], "SELF_SUBMITTED")
        self.assertEqual(Decimal(res.data["self_score"]), Decimal("4.00"))  # N/A excluded
        self.assertEqual(self.api("post", f"appraisal/{r.id}/self", {"answers": na, "submit": True}).data["code"], "SELF_LOCKED")


class ManagerTests(Base):
    def test_only_own_manager_and_mandatory_discussion(self):
        r = self.submitted()
        body = {"answers": self.answers(r), "comments": "Strong year with steady delivery", "recommendation": "INCREMENT"}
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/save", body, user=self.other).data["code"], "NOT_FOUND")
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/save", body, user=self.hr).data["code"], "NOT_FOUND")
        res = self.api("post", f"manager/reviews/{r.id}/save", body, user=self.mgr)
        self.assertNotIn("current_gross", res.data)
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/complete", user=self.mgr).data["code"], "MEETING_REQUIRED")
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/meeting", {"meeting_date": str(WINDOW + timedelta(days=1)), "strengths": "Ownership and quality",
                                                                             "development_plan": "Lead a small project"}, user=self.mgr).data["code"], "MEETING_IN_FUTURE")
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/meeting", {"meeting_date": str(WINDOW), "strengths": "x", "development_plan": "y"}, user=self.mgr).data["code"], "MEETING_DETAILS_REQUIRED")
        self.api("post", f"manager/reviews/{r.id}/meeting", {"meeting_date": str(WINDOW), "strengths": "Ownership and quality", "development_plan": "Lead a small project"}, user=self.mgr)
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/complete", user=self.mgr).data["code"], "ACK_REQUIRED")
        self.assertIsNotNone(self.api("post", f"appraisal/{r.id}/acknowledge", {"comments": "I'd like more mentoring"}).data["employee_ack_at"])
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/complete", user=self.mgr).data["status"], "MANAGER_COMPLETED")
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/save", body, user=self.mgr).data["code"], "NOT_WITH_MANAGER")


class AdminTests(Base):
    def test_outcome_rules_increment_and_promotion(self):
        r = self.completed()
        url = f"admin/appraisals/{r.id}/decision"
        self.assertEqual(self.api("post", url, {"decision": "APPROVE", "final_rating": 4}, user=self.hr).status_code, 403)
        self.assertEqual(self.api("post", url, {"decision": "APPROVE"}, user=self.admin).data["code"], "RATING_REQUIRED")
        self.assertEqual(self.api("post", url, {"decision": "APPROVE", "final_rating": 4.2, "new_gross": "30000"}, user=self.admin).data["code"], "EFFECTIVE_DATE_REQUIRED")
        self.assertEqual(self.api("post", url, {"decision": "APPROVE", "final_rating": 4.2, "new_gross": "30000", "effective_date": str(WINDOW)}, user=self.admin).data["code"], "NOT_AN_INCREMENT")
        self.assertEqual(self.api("post", url, {"decision": "APPROVE", "final_rating": 4.2, "new_gross": "36000", "effective_date": str(WINDOW - timedelta(days=1))}, user=self.admin).data["code"], "EFFECTIVE_IN_PAST")
        eff = date(2027, 2, 1)
        res = self.api("post", url, {"decision": "APPROVE", "final_rating": 4.2, "new_gross": "36000", "new_designation": "Senior Engineer", "effective_date": str(eff)}, user=self.admin)
        self.assertEqual(res.data["status"], "APPROVED", res.data)
        e = Employee.objects.get(pk=self.emp.employee.pk)
        sv = e.salary_versions.get(effective_from=eff)
        self.assertEqual((sv.monthly_gross, sum(Decimal(c["amount"]) for c in sv.components if c["type"] == "EARNING")), (Decimal("36000.00"), Decimal("36000.00")))
        self.assertEqual(e.designation, "Engineer")  # promotion waits for its effective date
        self.assertEqual(Letter.objects.get(employee=e, kind="SALARY_REVISION").status, "RELEASED")
        mine = self.api("get", "appraisal/me").data["reviews"][0]
        self.assertEqual((str(mine["final_rating"]), "new_gross" in mine), ("4.2", False))
        self.assertNotIn("new_gross", self.api("get", "manager/reviews", user=self.mgr).data["reviews"][0])
        self.assertNotIn("final_rating", self.api("get", "hr/appraisals", user=self.hr).data["reviews"][0])
        self.at(eff)
        self.api("get", "admin/appraisals", user=self.admin)
        self.assertEqual(Employee.objects.get(pk=e.pk).designation, "Senior Engineer")

    def test_send_back(self):
        r = self.completed()
        url = f"admin/appraisals/{r.id}/decision"
        self.assertEqual(self.api("post", url, {"decision": "SEND_BACK"}, user=self.admin).data["code"], "NOTE_REQUIRED")
        self.assertEqual(self.api("post", url, {"decision": "SEND_BACK", "note": "Add delivery evidence"}, user=self.admin).data["status"], "SELF_SUBMITTED")
        self.assertEqual(self.api("post", f"manager/reviews/{r.id}/complete", user=self.mgr).data["status"], "MANAGER_COMPLETED")  # ack and meeting kept
