"""Recruitment: candidates, interviews, scorecards, selection, offers (BRD §9, §21). Synthetic data only."""
import re
from datetime import timedelta
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from common.models import NotificationOutbox
from common.testing import Fixture
from recruitment import services as svc
from recruitment.models import Candidate, Feedback, InterviewRound, Offer

PDF = b"%PDF-1.4\n% synthetic test file\n"
GOOD = {"evaluation": "GOOD", "rating": 4, "remark": "Solid answers with examples"}


class Base(Fixture):
    def setUp(self):
        super().setUp()
        self.h = self.as_user(self.hr)

    def api(self, method, path, body=None, user=None, fmt="json"):
        c = self.as_user(user) if user else self.h
        return getattr(c, method)(f"/api/v1/{path}", body, format=fmt)

    def add(self, name="Riya Test", email="riya@example.test", phone="9000000001", **kw):
        return self.api("post", "hr/candidates", {"name": name, "email": email, "phone": phone, "role_applied": "Frontend Developer", "template_code": "DEVELOPER", **kw})

    def round(self, cid, when=None, **kw):
        body = {"kind": "TECHNICAL", "scheduled_at": (when or timezone.now() + timedelta(days=1)).isoformat(), "mode": "ONLINE",
                "meeting_url": "https://meet.example.test/abc", "interviewers": [str(self.emp.employee.id)], **kw}
        return self.api("post", f"hr/candidates/{cid}/interviews", body)

    def started(self, rid):
        InterviewRound.objects.filter(pk=rid).update(scheduled_at=timezone.now() - timedelta(minutes=5))

    def answers(self, **over):
        keys = ["coding", "js_react", "problem_solving", "quality", "collaboration"]
        return [{"key": k, **GOOD, **over.get(k, {})} for k in keys]

    def scored(self):
        """A candidate with one submitted scorecard, waiting for selection."""
        cid = self.add().data["id"]
        rid = self.round(cid).data["id"]
        self.started(rid)
        r = self.api("post", f"interviews/{rid}/feedback", {"answers": self.answers(), "overall": "RECOMMENDED", "submit": True}, user=self.emp)
        self.assertEqual(r.status_code, 200, r.data)
        return cid, rid

    def offer_body(self, **kw):
        return {"designation": "Frontend Developer", "department": str(self.dept.id), "joining_date": str(timezone.localdate() + timedelta(days=20)),
                "work_location": "Hyderabad office", "terms": "Standard company policies apply.", **kw}

    def sent_offer(self):
        cid, _ = self.scored()
        self.api("post", f"admin/candidates/{cid}/decision", {"decision": "SELECT"}, user=self.admin)
        oid = self.api("post", f"hr/candidates/{cid}/offer", self.offer_body()).data["id"]
        self.api("post", f"hr/offers/{oid}/submit")
        r = self.api("post", f"admin/offers/{oid}/decision", {"decision": "APPROVE", "monthly_gross": "50000"}, user=self.admin)
        self.assertEqual(r.data["status"], "SENT", r.data)
        body = NotificationOutbox.objects.get(dedupe_key=f"offer-sent:{oid}").body
        return cid, oid, re.search(r"/candidate/offer/(\S+)", body).group(1)


class CandidateTests(Base):
    def test_add_with_resume_and_block_duplicates(self):
        r = self.api("post", "hr/candidates", {"name": "Riya Test", "email": "Riya@Example.test", "phone": "+91 90000 00001", "role_applied": "Dev",
                                               "resume": SimpleUploadedFile("cv.pdf", PDF, "application/pdf")}, fmt="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["has_resume"])
        self.assertEqual(self.add(email="riya@example.test", phone="9111111111").data["code"], "DUPLICATE_CANDIDATE")
        dup = self.add(email="new@example.test", phone="09000000001")
        self.assertEqual((dup.data["code"], dup.data["field_errors"]["existing"]), ("DUPLICATE_CANDIDATE", [r.data["id"]]))
        self.assertEqual(self.add(email="emp@test.example", phone="9222222222").data["code"], "ALREADY_EMPLOYEE")

    def test_file_type_is_sniffed_not_trusted(self):
        r = self.api("post", "hr/candidates", {"name": "A B", "email": "a@example.test", "phone": "9000000002", "role_applied": "Dev",
                                               "resume": SimpleUploadedFile("cv.pdf", b"MZ not a pdf", "application/pdf")}, fmt="multipart")
        self.assertEqual(r.data["code"], "FILE_TYPE")

    def test_only_hr_and_admin_see_candidates(self):
        self.assertEqual(self.api("get", "hr/candidates", user=self.emp).status_code, 403)
        self.assertEqual(self.api("get", "hr/candidates", user=self.mgr).status_code, 403)
        self.assertEqual(self.api("get", "hr/candidates", user=self.admin).status_code, 200)


class InterviewTests(Base):
    def test_schedule_rules_and_invites(self):
        cid = self.add().data["id"]
        self.assertEqual(self.round(cid, when=timezone.now() - timedelta(hours=1)).data["code"], "IN_THE_PAST")
        self.assertEqual(self.round(cid, meeting_url="http://x.test").data["code"], "MEETING_URL_REQUIRED")
        self.assertEqual(self.round(cid, mode="ONSITE", location="").data["code"], "LOCATION_REQUIRED")
        self.assertEqual(self.round(cid, interviewers=[]).data["code"], "INTERVIEWER_REQUIRED")
        rid = self.round(cid).data["id"]
        self.assertEqual(Candidate.objects.get(pk=cid).stage, "INTERVIEWING")
        to = set(NotificationOutbox.objects.filter(template_key="interview").values_list("recipient", flat=True))
        self.assertEqual(to, {"riya@example.test", "emp@test.example"})
        r = self.api("put", f"hr/interviews/{rid}", {"kind": "TECHNICAL", "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(), "mode": "ONLINE",
                                                     "meeting_url": "https://meet.example.test/new", "interviewers": [str(self.emp.employee.id)]})
        self.assertEqual(r.data["reschedules"], 1)
        self.assertEqual(NotificationOutbox.objects.filter(template_key="interview", subject__startswith="Updated").count(), 2)

    def test_interviewer_scope(self):
        cid = self.api("post", "hr/candidates", {"name": "Riya Test", "email": "r@example.test", "phone": "9000000003", "role_applied": "Dev",
                                                 "resume": SimpleUploadedFile("cv.pdf", PDF)}, fmt="multipart").data["id"]
        self.round(cid)
        self.assertEqual(len(self.api("get", "interviews/assigned", user=self.emp).data["rounds"]), 1)
        self.assertEqual(self.api("get", "interviews/assigned", user=self.other).data["rounds"], [])
        self.assertEqual(self.api("get", f"candidates/{cid}/resume", user=self.emp).status_code, 200)
        self.assertEqual(self.api("get", f"candidates/{cid}/resume", user=self.other).status_code, 422)
        self.assertEqual(self.api("get", f"hr/candidates/{cid}", user=self.emp).status_code, 403)


class FeedbackTests(Base):
    def test_scorecard_rules_lock_and_amend(self):
        cid = self.add().data["id"]
        rid = self.round(cid).data["id"]
        post = lambda body, user=self.emp: self.api("post", f"interviews/{rid}/feedback", body, user=user)  # noqa: E731
        self.assertEqual(post({"answers": self.answers(), "overall": "RECOMMENDED", "submit": True}).data["code"], "NOT_YET")
        self.started(rid)
        self.assertEqual(post({"answers": self.answers(), "overall": "RECOMMENDED", "submit": True}, user=self.other).data["code"], "NOT_ASSIGNED")
        self.assertEqual(post({"answers": self.answers()[:4], "overall": "RECOMMENDED", "submit": True}).data["code"], "ANSWER_REQUIRED")
        self.assertEqual(post({"answers": self.answers(coding={"remark": ""}), "overall": "RECOMMENDED", "submit": True}).data["code"], "EVIDENCE_REQUIRED")
        self.assertEqual(post({"answers": self.answers(), "submit": True}).data["code"], "OVERALL_REQUIRED")
        self.assertIsNone(post({"answers": self.answers()[:2]}).data["submitted_at"])  # a draft saves partially
        r = post({"answers": self.answers(quality={"evaluation": "NOT_EVALUATED", "rating": None}, coding={"rating": 5}), "overall": "RECOMMENDED", "submit": True})
        self.assertEqual(r.data["score"], 4.29)  # (5*2 + 4*2 + 4*2 + 4*1) / 7, quality excluded
        self.assertEqual(Candidate.objects.get(pk=cid).stage, "SELECTION_PENDING")
        self.assertEqual(InterviewRound.objects.get(pk=rid).status, "COMPLETED")
        self.assertEqual(post({"answers": self.answers(), "overall": "NEXT_ROUND", "submit": True}).data["code"], "AMEND_REASON_REQUIRED")
        r = post({"answers": self.answers(), "overall": "NEXT_ROUND", "submit": True, "amend_reason": "Second look at the code sample"})
        self.assertEqual(r.data["revision"], 2)
        self.assertEqual(Feedback.objects.filter(round_id=rid).count(), 2)  # revision 1 kept
        self.assertEqual(self.api("get", f"hr/candidates/{cid}").data["feedback"][0]["revision"], 2)

    def test_weighted_score_excludes_not_evaluated(self):
        q = [{"key": "a", "weight": 2}, {"key": "b", "weight": 1}]
        self.assertEqual(svc.score(q, [{"key": "a", "rating": 3, "evaluation": "AVERAGE"}, {"key": "b", "rating": None, "evaluation": "NOT_EVALUATED"}]), Decimal("3.00"))
        self.assertIsNone(svc.score(q, [{"key": "a", "rating": None, "evaluation": "NOT_EVALUATED"}]))


class SelectionAndOfferTests(Base):
    def test_only_admin_selects_and_needs_feedback(self):
        bare = self.add(email="x@example.test", phone="9000000009").data["id"]
        self.round(bare)
        self.assertEqual(self.api("post", f"admin/candidates/{bare}/decision", {"decision": "SELECT"}, user=self.admin).data["code"], "INCOMPLETE_FEEDBACK")
        cid, _ = self.scored()
        self.assertEqual(self.api("post", f"admin/candidates/{cid}/decision", {"decision": "SELECT"}).status_code, 403)
        self.assertEqual(self.api("post", f"admin/candidates/{cid}/decision", {"decision": "REJECT"}, user=self.admin).data["code"], "NOTE_REQUIRED")
        self.assertEqual(self.api("post", f"admin/candidates/{cid}/decision", {"decision": "SELECT"}, user=self.admin).data["stage"], "SELECTED")

    def test_offer_salary_is_redacted_for_hr_and_sent_once(self):
        cid, _ = self.scored()
        self.assertEqual(self.api("post", f"hr/candidates/{cid}/offer", self.offer_body()).data["code"], "NOT_SELECTED")
        self.api("post", f"admin/candidates/{cid}/decision", {"decision": "SELECT"}, user=self.admin)
        self.assertEqual(self.api("post", f"hr/candidates/{cid}/offer", self.offer_body(joining_date=str(timezone.localdate()))).data["code"], "JOINING_IN_PAST")
        r = self.api("post", f"hr/candidates/{cid}/offer", self.offer_body(monthly_gross="99999"))
        oid = r.data["id"]
        self.assertNotIn("monthly_gross", r.data)
        self.assertIn(svc.REDACTED, r.data["letter"])
        self.assertIsNone(Offer.objects.get(pk=oid).monthly_gross)  # HR can't set salary
        self.assertEqual(self.api("post", f"hr/offers/{oid}/submit").data["status"], "PENDING_ADMIN")
        self.assertEqual(self.api("post", f"admin/offers/{oid}/decision", {"decision": "APPROVE", "monthly_gross": "50000"}).status_code, 403)
        self.assertEqual(self.api("post", f"admin/offers/{oid}/decision", {"decision": "APPROVE"}, user=self.admin).data["code"], "SALARY_REQUIRED")
        r = self.api("post", f"admin/offers/{oid}/decision", {"decision": "APPROVE", "monthly_gross": "50000"}, user=self.admin)
        self.assertEqual(r.data["status"], "SENT")
        self.assertIn("₹50,000.00 per month", r.data["letter"])
        self.assertEqual(len(r.data["digest"]), 64)
        self.assertEqual(self.api("post", f"admin/offers/{oid}/decision", {"decision": "APPROVE", "monthly_gross": "50000"}, user=self.admin).data["code"], "NOT_PENDING")
        self.assertEqual(NotificationOutbox.objects.filter(dedupe_key=f"offer-sent:{oid}").count(), 1)
        hr_view = self.api("get", f"hr/candidates/{cid}").data["offer"]
        self.assertNotIn("monthly_gross", hr_view)
        self.assertNotIn("50,000", hr_view["letter"])

    def test_needs_changes_returns_to_hr(self):
        cid, _ = self.scored()
        self.api("post", f"admin/candidates/{cid}/decision", {"decision": "SELECT"}, user=self.admin)
        oid = self.api("post", f"hr/candidates/{cid}/offer", self.offer_body()).data["id"]
        self.api("post", f"hr/offers/{oid}/submit")
        r = self.api("post", f"admin/offers/{oid}/decision", {"decision": "NEEDS_CHANGES", "note": "Fix the location"}, user=self.admin)
        self.assertEqual((r.data["status"], r.data["admin_note"]), ("DRAFT", "Fix the location"))
        self.assertEqual(self.api("post", f"hr/candidates/{cid}/offer", self.offer_body(work_location="Hitech City office")).data["status"], "DRAFT")


class CandidatePortalTests(Base):
    def public(self, method, token, body=None):
        return getattr(self.client, method)(f"/api/v1/candidate/offers/{token}", body, format="json")

    def test_accept_needs_matching_name_and_consent_once(self):
        cid, oid, token = self.sent_offer()
        self.assertEqual(self.public("get", "wrong-token").data["code"], "INVALID_LINK")
        g = self.public("get", token)
        self.assertEqual(g.data["status"], "SENT")
        self.assertIn("₹50,000.00", g.data["letter"])  # the candidate sees their own salary
        self.assertEqual(self.public("post", token, {"decision": "ACCEPT", "signed_name": "Someone Else", "consent": True}).data["code"], "NAME_MISMATCH")
        self.assertEqual(self.public("post", token, {"decision": "ACCEPT", "signed_name": "riya  test", "consent": False}).data["code"], "CONSENT_REQUIRED")
        self.assertEqual(self.public("post", token, {"decision": "ACCEPT", "signed_name": "riya  test", "consent": True}).data["status"], "ACCEPTED")
        self.assertEqual(self.public("post", token, {"decision": "DECLINE"}).data["code"], "ALREADY_RESPONDED")
        o = Offer.objects.get(pk=oid)
        self.assertEqual((o.signed_name, Candidate.objects.get(pk=cid).stage), ("riya test", "OFFER_ACCEPTED"))
        self.assertTrue(o.response_ip in ("127.0.0.0/24", ""))

    def test_expired_offer(self):
        cid, oid, token = self.sent_offer()
        Offer.objects.filter(pk=oid).update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.public("get", token).data["status"], "EXPIRED")
        self.assertEqual(self.public("post", token, {"decision": "ACCEPT", "signed_name": "Riya Test", "consent": True}).data["code"], "OFFER_EXPIRED")
        self.assertEqual(Candidate.objects.get(pk=cid).stage, "SELECTED")  # HR can make a fresh offer

    def test_decline_with_reason(self):
        cid, _, token = self.sent_offer()
        self.assertEqual(self.public("post", token, {"decision": "DECLINE", "reason": "Accepted another offer"}).data["status"], "DECLINED")
        self.assertEqual(Candidate.objects.get(pk=cid).stage, "OFFER_DECLINED")
