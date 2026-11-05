"""Preboarding portal, document checks, Mark Joined, letters, probation (BRD §3.3, §10, §21). Synthetic data only."""
import re
from datetime import timedelta
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from common.models import NotificationOutbox
from employees.models import Employee
from onboarding.models import CandidateDocument, DocumentRequest, Letter
from recruitment.models import Candidate, Offer
from recruitment.tests import PDF, Base as RecruitBase

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 20


class Base(RecruitBase):
    def accepted(self):
        cid, oid, token = self.sent_offer()
        r = self.client.post(f"/api/v1/candidate/offers/{token}", {"decision": "ACCEPT", "signed_name": "Riya Test", "consent": True}, format="json")
        self.assertEqual(r.data["status"], "ACCEPTED")
        return cid, oid

    def ask_docs(self, cid, cats=("EDUCATION", "PHOTO")):
        r = self.api("post", f"hr/onboarding/{cid}/request-documents", {"categories": list(cats)})
        self.assertEqual(r.status_code, 200, r.data)
        body = NotificationOutbox.objects.filter(template_key="preboarding").latest("created_at").body
        return re.search(r"/candidate/documents/(\S+)", body).group(1)

    def portal(self, path, body=None, session=None, fmt="json"):
        h = {"HTTP_X_PORTAL_SESSION": session} if session else {}
        return self.client.post(f"/api/v1/candidate/portal/{path}", body, format=fmt, **h) if body is not None or path.endswith(("otp", "verify")) else self.client.get(f"/api/v1/candidate/portal/{path}", **h)

    def otp(self):
        return re.search(r"Your code: (\d{6})", NotificationOutbox.objects.filter(template_key="otp").latest("created_at").subject).group(1)

    def login(self, token):
        self.assertIn("•", self.portal(f"{token}/otp").data["sent_to"])
        r = self.portal(f"{token}/verify", {"code": self.otp()})
        self.assertEqual(r.status_code, 200, r.data)
        return r.data["session"]

    def up(self, session, cat, data=PDF, name="doc.pdf"):
        return self.client.post("/api/v1/candidate/portal/session", {"category": cat, "file": SimpleUploadedFile(name, data)}, format="multipart", HTTP_X_PORTAL_SESSION=session)

    def ready_to_join(self):
        """Accepted, both documents verified, joining date today."""
        cid, oid = self.accepted()
        s = self.login(self.ask_docs(cid))
        for cat in ("EDUCATION", "PHOTO"):
            self.assertEqual(self.up(s, cat, PNG if cat == "PHOTO" else PDF).status_code, 201)
        for d in CandidateDocument.objects.filter(candidate_id=cid):
            self.api("post", f"hr/documents/{d.id}/review", {"status": "VERIFIED"})
        Offer.objects.filter(pk=oid).update(joining_date=timezone.localdate())
        return cid, oid, s


class PortalTests(Base):
    def test_request_needs_accepted_offer_and_categories(self):
        cid, _, token = self.sent_offer()
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/request-documents", {"categories": ["EDUCATION"]}).data["code"], "OFFER_NOT_ACCEPTED")
        self.client.post(f"/api/v1/candidate/offers/{token}", {"decision": "ACCEPT", "signed_name": "Riya Test", "consent": True}, format="json")
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/request-documents", {"categories": ["AADHAAR", "PAN"]}).data["code"], "CATEGORIES_REQUIRED")
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/request-documents", {"categories": ["EDUCATION"]}, user=self.emp).status_code, 403)
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/request-documents", {"categories": ["EDUCATION"]}).status_code, 200)

    def test_otp_single_use_link_and_lockout(self):
        cid, _ = self.accepted()
        token = self.ask_docs(cid)
        self.assertEqual(self.portal("not-a-token/otp").data["code"], "INVALID_LINK")
        self.portal(f"{token}/otp")
        for _ in range(4):
            self.assertEqual(self.portal(f"{token}/verify", {"code": "000000" if self.otp() != "000000" else "111111"}).data["code"], "OTP_WRONG")
        self.portal(f"{token}/verify", {"code": "999999" if self.otp() != "999999" else "888888"})
        self.assertEqual(self.portal(f"{token}/verify", {"code": self.otp()}).data["code"], "OTP_LOCKED")  # even the right code, after 5 misses
        self.portal(f"{token}/otp")
        session = self.portal(f"{token}/verify", {"code": self.otp()}).data["session"]
        self.assertTrue(session)
        self.assertEqual(self.portal(f"{token}/otp").data["code"], "LINK_USED")
        self.assertEqual([i["category"] for i in self.portal("session", session=session).data["items"]], ["EDUCATION", "PHOTO"])

    def test_otp_hourly_limit_and_expiry(self):
        cid, _ = self.accepted()
        token = self.ask_docs(cid)
        for _ in range(5):
            self.portal(f"{token}/otp")
        self.assertEqual(self.portal(f"{token}/otp").data["code"], "OTP_LIMIT")
        DocumentRequest.objects.filter(candidate_id=cid).update(otp_expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.portal(f"{token}/verify", {"code": self.otp()}).data["code"], "OTP_EXPIRED")
        DocumentRequest.objects.filter(candidate_id=cid).update(link_expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.portal(f"{token}/verify", {"code": "123456"}).data["code"], "LINK_EXPIRED")

    def test_upload_rules(self):
        cid, _ = self.accepted()
        s = self.login(self.ask_docs(cid))
        self.assertEqual(self.up("bad-session", "EDUCATION").data["code"], "SESSION_EXPIRED")
        self.assertEqual(self.up(s, "EXPERIENCE").data["code"], "NOT_REQUESTED")
        self.assertEqual(self.up(s, "EDUCATION", b"MZ fake", "x.pdf").data["code"], "FILE_TYPE")
        self.assertEqual(self.up(s, "EDUCATION", b"PK\x03\x04junk", "x.docx").data["code"], "FILE_TYPE")
        self.assertEqual(self.up(s, "EDUCATION").status_code, 201)
        self.assertEqual(self.up(s, "EDUCATION").status_code, 201)  # replaces the earlier one
        self.assertEqual(CandidateDocument.objects.filter(candidate_id=cid, superseded=False).count(), 1)
        self.assertEqual(CandidateDocument.objects.filter(candidate_id=cid, superseded=True).count(), 1)
        DocumentRequest.objects.filter(candidate_id=cid).update(session_expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.up(s, "PHOTO", PNG).data["code"], "SESSION_EXPIRED")


class ReviewTests(Base):
    def test_hr_review_rules(self):
        cid, _ = self.accepted()
        s = self.login(self.ask_docs(cid))
        self.up(s, "EDUCATION")
        d = CandidateDocument.objects.get(candidate_id=cid)
        self.assertEqual(self.api("post", f"hr/documents/{d.id}/review", {"status": "VERIFIED"}, user=self.emp).status_code, 403)
        self.assertEqual(self.api("post", f"hr/documents/{d.id}/review", {"status": "NEEDS_REUPLOAD"}).data["code"], "NOTE_REQUIRED")
        self.assertEqual(self.api("post", f"hr/documents/{d.id}/review", {"status": "NEEDS_REUPLOAD", "note": "The scan is blurry"}).data["status"], "NEEDS_REUPLOAD")
        self.assertTrue(NotificationOutbox.objects.filter(dedupe_key=f"reupload:{d.id}").exists())
        self.up(s, "EDUCATION")
        new = CandidateDocument.objects.get(candidate_id=cid, superseded=False)
        self.assertEqual(self.api("post", f"hr/documents/{d.id}/review", {"status": "VERIFIED"}).data["code"], "SUPERSEDED")
        self.api("post", f"hr/documents/{new.id}/review", {"status": "VERIFIED"})
        self.assertEqual(self.up(s, "EDUCATION").data["code"], "ALREADY_VERIFIED")
        self.assertEqual(self.api("get", f"documents/{new.id}/file").status_code, 200)
        self.assertEqual(self.api("get", f"documents/{new.id}/file", user=self.emp).status_code, 422)
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/checklist", {"key": "documents", "done": True}).data["code"], "MISSING_DOCUMENTS")  # PHOTO not in


class JoinTests(Base):
    def test_mark_joined_rules_and_result(self):
        cid, oid, s = self.ready_to_join()
        Offer.objects.filter(pk=oid).update(joining_date=timezone.localdate() + timedelta(days=1))
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/join", {"official_email": "riya@antro.test"}).data["code"], "NOT_JOINING_YET")
        Offer.objects.filter(pk=oid).update(joining_date=timezone.localdate())
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/join", {"official_email": "riya@example.test"}).data["code"], "PERSONAL_EMAIL")
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/join", {"official_email": "emp@test.example"}).data["code"], "DUPLICATE_EMAIL")
        r = self.api("post", f"hr/onboarding/{cid}/join", {"official_email": "riya@antro.test"})
        self.assertEqual(r.status_code, 201, r.data)
        emp = Employee.objects.get(official_email="riya@antro.test")
        self.assertEqual((emp.status, emp.designation, emp.start_date, bool(emp.employee_code)), ("PROBATION", "Frontend Developer", timezone.localdate(), True))
        sv = emp.salary_versions.get()
        self.assertEqual(sum(Decimal(c["amount"]) for c in sv.components), sv.monthly_gross)
        self.assertEqual(sv.monthly_gross, Decimal("50000.00"))
        self.assertEqual(Candidate.objects.get(pk=cid).stage, "JOINED")
        self.assertEqual(self.portal("session", session=s).data["code"], "SESSION_EXPIRED")  # portal closes at conversion
        self.assertEqual(Letter.objects.get(employee=emp).status, "PENDING_ADMIN")
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/join", {"official_email": "x@antro.test"}).data["code"], "ALREADY_JOINED")
        self.assertTrue(NotificationOutbox.objects.filter(recipient="riya@antro.test", template_key="ACCOUNT_INVITE").exists())

    def test_missing_documents_block_joining(self):
        cid, oid = self.accepted()
        self.assertEqual(self.api("post", f"hr/onboarding/{cid}/join", {"official_email": "r@antro.test"}).data["code"], "MISSING_DOCUMENTS")


class LetterTests(Base):
    def joined(self):
        cid, _, _ = self.ready_to_join()
        self.api("post", f"hr/onboarding/{cid}/join", {"official_email": "riya@antro.test"})
        return Employee.objects.get(official_email="riya@antro.test")

    def test_appointment_letter_redacted_for_hr_and_released_by_admin(self):
        emp = self.joined()
        letter = Letter.objects.get(employee=emp)
        hr = self.api("get", f"letters/{letter.id}").data
        self.assertNotIn("50,000", hr["content"])
        self.assertIn("[confidential", hr["content"])
        self.assertEqual(self.api("post", f"admin/letters/{letter.id}/decision", {"decision": "APPROVE"}).status_code, 403)
        r = self.api("post", f"admin/letters/{letter.id}/decision", {"decision": "APPROVE"}, user=self.admin)
        self.assertEqual(r.data["status"], "RELEASED")
        self.assertIn("₹50,000.00", r.data["content"])
        self.assertEqual(len(r.data["digest"]), 64)
        mail = NotificationOutbox.objects.get(dedupe_key=f"letter:{letter.id}")
        self.assertNotIn("50,000", mail.body)  # no salary in email bodies
        mine = self.api("get", "documents/me", user=emp.user).data
        self.assertIn("₹50,000.00", mine["letters"][0]["content"])
        self.assertEqual(len(mine["documents"]), 2)
        self.assertEqual(self.api("get", f"letters/{letter.id}", user=self.other).status_code, 422)
        self.assertEqual(self.api("post", f"admin/letters/{letter.id}/decision", {"decision": "APPROVE"}, user=self.admin).data["code"], "NOT_PENDING")

    def test_templates_and_missing_values(self):
        self.assertEqual(self.api("put", "admin/letter-templates", {"kind": "EXPERIENCE", "body": "Hello {{employee.pan}} " * 5}, user=self.admin).data["code"], "UNKNOWN_PLACEHOLDER")
        self.assertEqual(self.api("put", "admin/letter-templates", {"kind": "EXPERIENCE", "body": "x"}, user=self.hr).status_code, 403)
        r = self.api("post", "hr/letters", {"employee": str(self.emp.employee.id), "kind": "EXPERIENCE"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.api("post", f"hr/letters/{r.data['id']}/submit").data["code"], "MISSING_VALUES")  # no last working date
        self.api("put", f"letters/{r.data['id']}", {"exit.last_working_date": "30 November 2026"})
        self.assertEqual(self.api("post", f"hr/letters/{r.data['id']}/submit").data["status"], "PENDING_ADMIN")
        body = "Dear {{employee.full_name}}, you worked here as {{employee.designation}} until {{exit.last_working_date}}."
        self.assertEqual(self.api("put", "admin/letter-templates", {"kind": "EXPERIENCE", "body": body}, user=self.admin).data["version"], 2)
        self.assertEqual(self.api("get", f"letters/{r.data['id']}").data["template_version"], 1)  # existing letters keep their version
        self.assertEqual(self.api("post", "hr/letters", {"employee": str(self.emp.employee.id), "kind": "SALARY_REVISION"}).data["code"], "INVALID_KIND")
        sent_back = self.api("post", f"admin/letters/{r.data['id']}/decision", {"decision": "NEEDS_CHANGES"}, user=self.admin)
        self.assertEqual(sent_back.data["code"], "NOTE_REQUIRED")


class ProbationTests(Base):
    def test_review_and_confirm(self):
        e = self.emp.employee  # joined 31 Jan 2026, 3-month probation: due
        self.assertIn(str(e.id), [x["id"] for x in self.api("get", "hr/onboarding").data["probation_due"]])
        self.assertEqual(self.api("post", f"hr/probation/{e.id}/review", {"recommendation": "CONFIRM", "note": "ok"}).data["code"], "NOTE_REQUIRED")
        self.assertEqual(self.api("post", f"hr/probation/{e.id}/review", {"recommendation": "EXTEND", "extend_months": 6, "note": "Needs more time on quality"}).data["code"], "INVALID_EXTENSION")
        r = self.api("post", f"hr/probation/{e.id}/review", {"recommendation": "CONFIRM", "note": "Consistently good work and attendance"})
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.api("post", f"hr/probation/{e.id}/review", {"recommendation": "CONFIRM", "note": "Consistently good work"}).data["code"], "REVIEW_OPEN")
        self.assertEqual(self.api("post", f"admin/probation/{r.data['id']}/decision", {"decision": "CONFIRM"}).status_code, 403)
        d = self.api("post", f"admin/probation/{r.data['id']}/decision", {"decision": "CONFIRM"}, user=self.admin)
        self.assertEqual(d.data["status"], "CONFIRMED")
        e.refresh_from_db()
        self.assertEqual(e.status, "ACTIVE_CONFIRMED")
        self.assertEqual(Letter.objects.get(employee=e, kind="PROBATION_CONFIRMATION").status, "RELEASED")
        self.assertEqual(self.api("post", f"hr/probation/{e.id}/review", {"recommendation": "CONFIRM", "note": "Consistently good work"}).data["code"], "NOT_ON_PROBATION")

    def test_extend_and_too_early(self):
        e = self.other.employee
        Employee.objects.filter(pk=e.pk).update(start_date=timezone.localdate() - timedelta(days=10))
        self.assertEqual(self.api("post", f"hr/probation/{e.id}/review", {"recommendation": "CONFIRM", "note": "Early but looks fine"}).data["code"], "TOO_EARLY")
        Employee.objects.filter(pk=e.pk).update(start_date=timezone.localdate() - timedelta(days=80))
        r = self.api("post", f"hr/probation/{e.id}/review", {"recommendation": "EXTEND", "extend_months": 2, "note": "Needs more time on code quality"})
        self.assertEqual(self.api("post", f"admin/probation/{r.data['id']}/decision", {"decision": "EXTEND", "extend_months": 2}, user=self.admin).data["code"], "NOTE_REQUIRED")
        d = self.api("post", f"admin/probation/{r.data['id']}/decision", {"decision": "EXTEND", "extend_months": 2, "note": "Agreed"}, user=self.admin)
        self.assertEqual(d.data["status"], "EXTENDED")
        e.refresh_from_db()
        self.assertEqual((e.probation_months, e.status), (5, "PROBATION"))
        self.assertIn(f"{e.probation_end:%d %B %Y}", Letter.objects.get(employee=e, kind="PROBATION_EXTENSION").content)
