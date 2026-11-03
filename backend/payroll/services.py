"""Monthly payroll engine (BRD §8). Decimal throughout, rounded to paise; nothing is deducted automatically for shortfall."""
import calendar
import hashlib
import json
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from attendance.services import policy
from common.errors import BusinessRuleError, ConflictError
from common.services import audit, notify, queue_email
from employees.models import Employee

from .models import PayrollRun, Payslip, SalaryVersion

R = PayrollRun.Status
PAISE = Decimal("0.01")
ZERO = Decimal("0")
BLOCKING = {"NEGATIVE_NET"}


def money(x) -> Decimal:
    return Decimal(x).quantize(PAISE, rounding=ROUND_HALF_UP)


def is_locked(org, year: int, month: int) -> bool:
    return PayrollRun.objects.filter(organization=org, year=year, month=month, status__in=[R.APPROVED, R.PAID]).exists()


def professional_tax(org, gross: Decimal) -> Decimal:
    """Telangana PT slabs from policy `payroll.pt_telangana` (<=15,000: 0; <=20,000: 150; above: 200)."""
    for slab in policy(org, "payroll.pt_telangana", [{"upto": 15000, "pt": 0}, {"upto": 20000, "pt": 150}, {"upto": None, "pt": 200}]):
        if slab["upto"] is None or gross <= Decimal(str(slab["upto"])):
            return money(slab["pt"])
    return ZERO


def _salary(employee: Employee, month_end: date) -> SalaryVersion | None:
    return employee.salary_versions.filter(effective_from__lte=month_end).order_by("-effective_from").first()


def _info(employee: Employee, start: date, end: date) -> dict:
    """Itemised for the approver only; none of this changes pay by itself (BRD §8.2)."""
    from attendance.models import AttendanceDay
    from leaves.models import LeaveRequest
    from leaves.services import working_days
    leave = {}
    for r in LeaveRequest.objects.filter(employee=employee, status="APPROVED", start__lte=end, end__gte=start):
        n = Decimal("0.5") if r.half_day else Decimal(len(working_days(employee, max(r.start, start), min(r.end, end))))
        leave[r.category] = float(Decimal(str(leave.get(r.category, 0))) + n)
    days = AttendanceDay.objects.filter(employee=employee, work_date__range=(start, end))
    return {"leave_days": leave, "attended_days": days.count(), "shortfall_days": days.exclude(shortfall_reason="").count()}


def build(slip: Payslip, run: PayrollRun, sv: SalaryVersion) -> None:
    emp, org = slip.employee, run.organization
    first = date(run.year, run.month, 1)
    last = date(run.year, run.month, calendar.monthrange(run.year, run.month)[1])
    month_days = Decimal(last.day)
    employed = Decimal((last - max(first, emp.start_date)).days + 1)
    paid_days = max(ZERO, employed - slip.unpaid_days)
    ratio = paid_days / month_days
    earnings = [{"code": c["code"], "name": c["name"], "amount": money(Decimal(c["amount"]) * ratio)} for c in sv.components if c["type"] == "EARNING"]
    deductions = [{"code": c["code"], "name": c["name"], "amount": money(c["amount"])} for c in sv.components if c["type"] == "DEDUCTION"]
    for a in slip.adjustments:
        (earnings if a["type"] == "EARNING" else deductions).append({"code": "ADJ", "name": a["name"], "amount": money(a["amount"]), "note": a.get("note", "")})
    gross = sum((e["amount"] for e in earnings), ZERO)
    flags = []
    pt = professional_tax(org, gross)
    deductions.insert(0, {"code": "PT", "name": "Professional Tax", "amount": pt})
    for key, label in (("payroll.pf_enabled", "PF"), ("payroll.tds_enabled", "TDS")):
        if policy(org, key, False):
            flags.append(f"{label}_RULES_MISSING")  # switched on in policy, but no reviewed rule pack yet: not deducted
    total = sum((d["amount"] for d in deductions), ZERO)
    net = gross - total
    if net < 0:
        flags.append("NEGATIVE_NET")
    if slip.unpaid_days > employed:
        flags.append("UNPAID_EXCEEDS_DAYS")
    data = {
        "employer": {"name": org.legal_name},
        "period": {"year": run.year, "month": run.month, "days": int(month_days)},
        "employee": {"code": emp.employee_code, "name": emp.display_name, "designation": emp.designation, "department": emp.department.name,
                     "joined": str(emp.start_date)},
        "salary_version": {"id": str(sv.id), "effective_from": str(sv.effective_from), "monthly_gross": str(sv.monthly_gross)},
        "paid_days": str(paid_days), "unpaid_days": str(slip.unpaid_days),
        "earnings": [{**e, "amount": str(e["amount"])} for e in earnings],
        "deductions": [{**d, "amount": str(d["amount"])} for d in deductions],
        "gross": str(gross), "total_deductions": str(total), "net": str(net),
        "info": _info(emp, first, last),
    }
    slip.data, slip.gross, slip.deductions, slip.net, slip.flags = data, gross, total, net, flags
    slip.digest = hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


@transaction.atomic
def calculate(org, year: int, month: int, actor, request=None) -> PayrollRun:
    """Create or recalculate the month's draft. Per-slip unpaid days and adjustments are kept across recalculation."""
    if not (1 <= month <= 12) or year < 2020:
        raise BusinessRuleError("INVALID_PERIOD", "Pick a valid month.")
    first = date(year, month, 1)
    if first > timezone.localdate():
        raise BusinessRuleError("FUTURE_MONTH", "Payroll can't be run for a future month.")
    last = date(year, month, calendar.monthrange(year, month)[1])
    run = PayrollRun.objects.select_for_update().filter(organization=org, year=year, month=month).first()
    if run and run.status != R.DRAFT:
        raise ConflictError("PAYROLL_LOCKED", "This month is approved and locked. Corrections go into next month as adjustments.")
    if run is None:
        run = PayrollRun.objects.create(organization=org, year=year, month=month, calculated_at=timezone.now())
    kept = {s.employee_id: s for s in run.payslips.all()}
    warnings, seen = [], set()
    people = Employee.objects.filter(organization=org, start_date__lte=last).exclude(status__in=["EXITED", "INACTIVE", "PREBOARDING"]).select_related("department")
    for emp in people:
        sv = _salary(emp, last)
        if sv is None:
            warnings.append({"employee": emp.display_name, "code": "NO_SALARY", "message": "No salary set; left out of this run."})
            continue
        slip = kept.get(emp.pk) or Payslip(run=run, employee=emp)
        build(slip, run, sv)
        slip.save()
        seen.add(emp.pk)
    run.payslips.exclude(employee_id__in=seen).delete()
    run.warnings, run.calculated_at = warnings, timezone.now()
    run.save(update_fields=["warnings", "calculated_at"])
    audit(actor=actor, action="PAYROLL_CALCULATED", entity=run, after={"period": f"{year}-{month:02d}", "payslips": len(seen)}, request=request)
    return run


@transaction.atomic
def adjust(slip: Payslip, unpaid_days: Decimal, adjustments: list[dict], actor, request=None) -> Payslip:
    run = PayrollRun.objects.select_for_update().get(pk=slip.run_id)
    if run.status != R.DRAFT:
        raise ConflictError("PAYROLL_LOCKED", "This month is approved and locked.")
    for a in adjustments:
        if len(a.get("note", "").strip()) < 3:
            raise BusinessRuleError("NOTE_REQUIRED", "Every adjustment needs a note explaining it.", field_errors={"adjustments": ["Add a note to each."]})
    slip.unpaid_days = unpaid_days
    slip.adjustments = [{**a, "amount": str(money(a["amount"]))} for a in adjustments]
    last = date(run.year, run.month, calendar.monthrange(run.year, run.month)[1])
    build(slip, run, _salary(slip.employee, last))
    slip.save()
    audit(actor=actor, action="PAYSLIP_ADJUSTED", entity=run, after={"employee_id": str(slip.employee_id), "unpaid_days": str(unpaid_days), "adjustments": len(adjustments)}, request=request)
    return slip


@transaction.atomic
def approve(run: PayrollRun, actor, request=None) -> PayrollRun:
    run = PayrollRun.objects.select_for_update().get(pk=run.pk)
    if run.status != R.DRAFT:
        raise ConflictError("ALREADY_APPROVED", "This month is already approved.")
    slips = list(run.payslips.select_related("employee"))
    if not slips:
        raise BusinessRuleError("EMPTY_RUN", "There are no payslips to approve.")
    bad = [s.employee.display_name for s in slips if BLOCKING & set(s.flags)]
    if bad:
        raise BusinessRuleError("PAYROLL_EXCEPTIONS", f"Fix these first (net pay below zero): {', '.join(bad)}.")
    run.status, run.approved_by, run.approved_at = R.APPROVED, actor, timezone.now()
    run.save(update_fields=["status", "approved_by", "approved_at"])
    audit(actor=actor, action="PAYROLL_APPROVED", entity=run, after={"period": f"{run.year}-{run.month:02d}", "payslips": len(slips)}, request=request)
    label = date(run.year, run.month, 1).strftime("%B %Y")
    notify([s.employee.user for s in slips], f"Your payslip for {label} is ready", "", "/app/payslips", tone="success")
    for s in slips:
        queue_email(template_key="payslip", recipient=s.employee.official_email, subject=f"Your payslip for {label} is ready",
                    body=f"Your payslip for {label} is available in Antro HRMS → Payslips.", dedupe_key=f"payslip:{s.pk}", organization=run.organization)
    return run


@transaction.atomic
def mark_paid(run: PayrollRun, actor, request=None) -> PayrollRun:
    run = PayrollRun.objects.select_for_update().get(pk=run.pk)
    if run.status != R.APPROVED:
        raise ConflictError("NOT_APPROVED", "Approve the month before recording payment.")
    run.status, run.paid_at = R.PAID, timezone.now()
    run.save(update_fields=["status", "paid_at"])
    audit(actor=actor, action="PAYROLL_PAID", entity=run, after={"period": f"{run.year}-{run.month:02d}"}, request=request)
    return run
