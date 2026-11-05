"""Assets, resignation, exit and F&F (BRD §11, §12, §21). Synthetic data only."""
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.sessions.backends.db import SessionStore
from django.utils import timezone

from common.models import NotificationOutbox
from common.testing import Fixture
from employees.models import Employee
from exits import services as svc
from exits.models import Asset, ExitCase
from onboarding.models import Letter


class Base(Fixture):
    def api(self, method, path, body=None, user=None):
        return getattr(self.as_user(user or self.hr), method)(f"/api/v1/{path}", body, format="json")

    def asset(self, tag="LAP-001", **kw):
        r = self.api("post", "hr/assets", {"category": "LAPTOP", "make_model": "ThinkPad T14", "tag": tag, "serial": "SN1", **kw})
        self.assertEqual(r.status_code, 201, r.data)
        return r.data["id"]

    def give(self, tag="LAP-001", user=None):
        aid = self.asset(tag)
        al = self.api("post", f"hr/assets/{aid}/assign", {"employee": str((user or self.emp).employee.id)}).data["id"]
        self.api("post", f"allocations/{al}/acknowledge", {"typed": tag}, user=user or self.emp)
        return aid, al

    def resign(self, days=30, user=None, reason="Moving to another city for family"):
        return self.api("post", "resignation/me", {"reason": reason, "proposed_last_day": str(timezone.localdate() + timedelta(days=days))}, user=user or self.emp)

    def accepted_exit(self, days=30):
        rid = self.resign(days).data["id"]
        self.assertEqual(self.api("post", f"admin/resignations/{rid}/decision", {"decision": "ACCEPT"}, user=self.admin).data["status"], "ACCEPTED")
        return ExitCase.objects.get(employee=self.emp.employee)


class AssetTests(Base):
    def test_create_rules_and_cost_privacy(self):
        self.asset(cost="85000")
        self.assertIsNone(Asset.objects.get(tag="LAP-001").cost)  # HR can't set cost
        self.assertEqual(self.api("post", "hr/assets", {"category": "LAPTOP", "make_model": "X1", "tag": "lap-001"}).data["code"], "DUPLICATE_TAG")
        self.assertEqual(self.api("post", "hr/assets", {"category": "PERSONAL_DEVICE", "make_model": "Own Mac", "tag": "BYOD-1"}).data["code"], "OWNER_REQUIRED")
        r = self.api("post", "hr/assets", {"category": "MONITOR", "make_model": "Dell 24", "tag": "MON-1", "cost": "12000"}, user=self.admin)
        self.assertEqual(str(r.data["cost"]), "12000.00")
        self.assertNotIn("cost", self.api("get", "hr/assets").data["assets"][0])
        self.assertEqual(self.api("get", "hr/assets", user=self.emp).status_code, 403)

    def test_assign_ack_and_good_return(self):
        aid = self.asset()
        al = self.api("post", f"hr/assets/{aid}/assign", {"employee": str(self.emp.employee.id)}).data["id"]
        self.assertEqual(self.api("post", f"hr/assets/{aid}/assign", {"employee": str(self.other.employee.id)}).data["code"], "NOT_AVAILABLE")
        self.assertEqual(self.api("post", f"allocations/{al}/acknowledge", {"typed": "LAP-001"}, user=self.other).data["code"], "NOT_FOUND")
        self.assertEqual(self.api("post", f"allocations/{al}/acknowledge", {"typed": "yes"}, user=self.emp).data["code"], "CONFIRMATION_MISMATCH")
        self.assertIsNotNone(self.api("post", f"allocations/{al}/acknowledge", {"typed": "lap-001"}, user=self.emp).data["ack_at"])
        self.assertEqual(self.api("post", f"allocations/{al}/acknowledge", {"typed": "LAP-001"}, user=self.emp).data["code"], "ALREADY_ACKNOWLEDGED")
        self.assertEqual(self.api("post", f"hr/allocations/{al}/return", {"condition": "GOOD"}).data["code"], "NOT_RETURNING")
        self.api("post", f"hr/allocations/{al}/return-start")
        self.assertEqual(self.api("post", f"allocations/{al}/confirm-return", {"agrees": True}, user=self.emp).data["code"], "NOT_READY")
        self.assertEqual(self.api("post", f"hr/allocations/{al}/return", {"condition": "DAMAGED"}).data["code"], "NOTE_REQUIRED")
        self.api("post", f"hr/allocations/{al}/return", {"condition": "GOOD"})
        r = self.api("post", f"allocations/{al}/confirm-return", {"agrees": True}, user=self.emp)
        self.assertIsNotNone(r.data["closed_at"])
        self.assertEqual(Asset.objects.get(pk=aid).state, "AVAILABLE")

    def test_dispute_goes_to_admin_and_no_auto_deduction(self):
        aid, al = self.give()
        self.api("post", f"hr/allocations/{al}/return-start")
        self.api("post", f"hr/allocations/{al}/return", {"condition": "DAMAGED", "note": "Cracked screen"})
        self.assertEqual(self.api("post", f"allocations/{al}/confirm-return", {"agrees": False}, user=self.emp).data["code"], "NOTE_REQUIRED")
        self.api("post", f"allocations/{al}/confirm-return", {"agrees": False, "note": "It was cracked when I got it"}, user=self.emp)
        self.assertEqual(Asset.objects.get(pk=aid).state, "RETURNED")
        self.assertEqual(self.api("post", f"admin/allocations/{al}/resolve", {"decision": "WRITE_OFF", "note": "x"}).status_code, 403)
        self.assertEqual(len(self.api("get", "admin/allocations/disputes", user=self.admin).data["disputes"]), 1)
        self.assertEqual(self.api("post", f"admin/allocations/{al}/resolve", {"decision": "RECOVERY_REVIEW", "note": "Discuss at F&F"}, user=self.admin).data["admin_decision"], "RECOVERY_REVIEW")
        self.assertEqual(self.api("post", f"admin/assets/{aid}/state", {"state": "WRITTEN_OFF", "note": "Beyond repair"}, user=self.admin).data["state"], "WRITTEN_OFF")

    def test_personal_device_cannot_be_assigned(self):
        aid = self.api("post", "hr/assets", {"category": "PERSONAL_DEVICE", "make_model": "Own Mac", "tag": "BYOD-1", "owner": str(self.emp.employee.id)}).data["id"]
        self.assertEqual(self.api("post", f"hr/assets/{aid}/assign", {"employee": str(self.emp.employee.id)}).data["code"], "PERSONAL_DEVICE")
        self.assertEqual(len(self.api("get", "assets/me", user=self.emp).data["personal"]), 1)


class ResignationTests(Base):
    def test_submit_rules(self):
        self.assertEqual(self.resign(reason="bye").data["code"], "REASON_REQUIRED")
        self.assertEqual(self.resign(days=-1).data["code"], "LAST_DAY_PASSED")
        self.assertEqual(self.resign(days=200).data["code"], "LAST_DAY_TOO_FAR")
        r = self.resign(days=10)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["short_notice"])
        self.assertIn("Moving to another city", r.data["letter"])
        self.assertEqual(self.resign().data["code"], "ALREADY_SUBMITTED")
        self.assertTrue(NotificationOutbox.objects.filter(template_key="resignation", recipient="admin@test.example").exists())

    def test_discussion_revise_withdraw(self):
        rid = self.resign().data["id"]
        self.assertEqual(self.api("post", f"admin/resignations/{rid}/decision", {"decision": "ACCEPT"}).status_code, 403)  # HR tracks only
        self.assertEqual(self.api("post", f"resignation/{rid}/revise", {"reason": "Moving to another city", "proposed_last_day": str(timezone.localdate() + timedelta(days=40))}, user=self.emp).data["code"], "NOT_REVISABLE")
        self.assertEqual(self.api("post", f"admin/resignations/{rid}/decision", {"decision": "DISCUSSION"}, user=self.admin).data["code"], "NOTE_REQUIRED")
        self.api("post", f"admin/resignations/{rid}/decision", {"decision": "NOTICE_REVISION", "note": "Please serve the full notice"}, user=self.admin)
        r = self.api("post", f"resignation/{rid}/revise", {"reason": "Moving to another city", "proposed_last_day": str(timezone.localdate() + timedelta(days=45))}, user=self.emp)
        self.assertEqual((r.data["revision"], r.data["status"], len(r.data["history"])), (2, "SUBMITTED", 1))
        self.assertEqual(self.api("post", f"resignation/{rid}/withdraw", user=self.emp).data["status"], "WITHDRAWN")
        self.assertEqual(self.resign().status_code, 201)  # can resign again later

    def test_accept_short_notice_needs_reason(self):
        rid = self.resign(days=5).data["id"]
        self.assertEqual(self.api("post", f"admin/resignations/{rid}/decision", {"decision": "ACCEPT"}, user=self.admin).data["code"], "SHORT_NOTICE_REASON")
        r = self.api("post", f"admin/resignations/{rid}/decision", {"decision": "ACCEPT", "note": "Notice waived by mutual agreement"}, user=self.admin)
        self.assertEqual(r.data["status"], "ACCEPTED")
        e = Employee.objects.get(pk=self.emp.employee.pk)
        self.assertEqual(e.status, "NOTICE_PERIOD")
        self.assertEqual(Letter.objects.get(employee=e, kind="RESIGNATION_ACCEPTANCE").status, "DRAFT")
        self.assertEqual(self.api("post", f"resignation/{rid}/withdraw", user=self.emp).data["code"], "NOT_WITHDRAWABLE")
        aid = self.asset("NEW-1")
        self.assertEqual(self.api("post", f"hr/assets/{aid}/assign", {"employee": str(e.id)}).data["code"], "ON_NOTICE")


class ExitTests(Base):
    def clear(self, ex):
        for k, _ in svc.EXIT_CHECKLIST:
            self.api("post", f"hr/exits/{ex.id}/checklist", {"key": k, "done": True})

    def test_fnf_needs_clearance_and_hr_never_sees_amounts(self):
        aid, al = self.give()
        ex = self.accepted_exit()
        hr_view = self.api("get", "hr/exits").data["exits"][0]
        self.assertNotIn("settlement", hr_view)
        self.assertIn("1 company asset not returned", hr_view["blockers"])
        self.assertEqual(self.api("get", f"admin/exits/{ex.id}/settlement").status_code, 403)
        st = self.api("get", f"admin/exits/{ex.id}/settlement", user=self.admin).data["settlement"]
        self.assertTrue(any(x["code"] == "BASIC" for x in st["lines"]))
        self.assertEqual(self.api("post", f"admin/exits/{ex.id}/settlement/approve", user=self.admin).data["code"], "EXIT_NOT_CLEARED")
        self.clear(ex)
        self.api("post", f"hr/allocations/{al}/return-start")
        self.api("post", f"hr/allocations/{al}/return", {"condition": "GOOD"})
        self.api("post", f"allocations/{al}/confirm-return", {"agrees": True}, user=self.emp)
        lines = st["lines"] + [{"name": "Notice recovery", "type": "DEDUCTION", "amount": "999999"}]
        self.assertEqual(self.api("put", f"admin/exits/{ex.id}/settlement", {"lines": lines}, user=self.admin).data["code"], "NOTE_REQUIRED")
        lines[-1]["note"] = "Agreed in writing"
        self.api("put", f"admin/exits/{ex.id}/settlement", {"lines": lines}, user=self.admin)
        self.assertEqual(self.api("post", f"admin/exits/{ex.id}/settlement/approve", user=self.admin).data["code"], "NEGATIVE_NET")
        lines[-1]["amount"] = "1000"
        r = self.api("put", f"admin/exits/{ex.id}/settlement", {"lines": lines}, user=self.admin)
        net = Decimal(r.data["settlement"]["net"])
        r = self.api("post", f"admin/exits/{ex.id}/settlement/approve", user=self.admin)
        self.assertEqual(r.data["fnf_status"], "APPROVED")
        fnf = Letter.objects.get(employee=self.emp.employee, kind="FNF_STATEMENT")
        self.assertEqual(fnf.status, "RELEASED")
        self.assertIn(f"₹{net:,.2f}", fnf.content)
        self.assertEqual(set(Letter.objects.filter(employee=self.emp.employee, status="DRAFT").values_list("kind", flat=True)), {"RESIGNATION_ACCEPTANCE", "EXPERIENCE", "RELIEVING"})
        self.assertEqual(self.api("put", f"admin/exits/{ex.id}/settlement", {"lines": lines}, user=self.admin).data["code"], "FNF_APPROVED")

    def test_access_revoked_only_after_last_day_and_clearance(self):
        ex = self.accepted_exit(days=0 + 30)
        self.clear(ex)
        self.api("post", f"admin/exits/{ex.id}/settlement/approve", user=self.admin)
        self.assertEqual(self.api("post", f"hr/exits/{ex.id}/complete").data["code"], "BEFORE_LAST_DAY")
        later = timezone.localdate() + timedelta(days=31)
        with mock.patch.object(svc, "today", lambda: later):
            self.assertEqual(self.api("post", f"hr/exits/{ex.id}/complete").data["code"], "EXIT_NOT_CLEARED")  # relieving letter not sent
            rel = Letter.objects.get(employee=self.emp.employee, kind="RELIEVING")
            self.api("post", f"hr/letters/{rel.id}/submit")
            self.api("post", f"admin/letters/{rel.id}/decision", {"decision": "APPROVE"}, user=self.admin)
            s = SessionStore()
            s["_auth_user_id"] = str(self.emp.pk)
            s.create()
            r = self.api("post", f"hr/exits/{ex.id}/complete")
            self.assertEqual(r.data["status"], "COMPLETED", r.data)
        self.emp.refresh_from_db()
        self.assertFalse(self.emp.is_active)
        self.assertEqual(Employee.objects.get(pk=self.emp.employee.pk).status, "EXITED")
        self.assertFalse(SessionStore().exists(s.session_key))
        rel = Letter.objects.get(employee=self.emp.employee, kind="RELIEVING")
        self.assertIn(rel.content.split("\n")[0], NotificationOutbox.objects.get(dedupe_key=f"letter:{rel.id}").body)  # relieving letter emailed in full
