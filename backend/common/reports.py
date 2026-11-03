"""Excel reports for the Super Admin: attendance register, leave report, salary register."""
import calendar
import io
from datetime import date, timedelta
from decimal import Decimal

from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from common.errors import BusinessRuleError

HEAD = PatternFill("solid", fgColor="3D5AFE")


def _sheet(wb, title, header, rows, widths=None):
    ws = wb.create_sheet(title[:31])
    ws.append(header)
    for c in ws[1]:
        c.font, c.fill, c.alignment = Font(bold=True, color="FFFFFF"), HEAD, Alignment(vertical="center", wrap_text=True)
    for r in rows:
        ws.append(r)
    ws.freeze_panes = "C2" if len(header) > 6 else "A2"
    for i, h in enumerate(header, 1):
        ws.column_dimensions[get_column_letter(i)].width = (widths or {}).get(i, max(10, min(32, len(str(h)) + 4)))
    return ws


def _xlsx(wb, name) -> HttpResponse:
    del wb["Sheet"]
    buf = io.BytesIO()
    wb.save(buf)
    r = HttpResponse(buf.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    r["Content-Disposition"] = f'attachment; filename="{name}.xlsx"'
    return r


def _month(q) -> tuple[int, int]:
    try:
        y, m = map(int, (q.get("month") or "").split("-"))
        date(y, m, 1)
        return y, m
    except (ValueError, TypeError):
        raise BusinessRuleError("INVALID_MONTH", "Pick a month (YYYY-MM).")


class AttendanceReport(APIView):
    """One row per person, one column per day: P present · WFH · CL/SL/EL leave (½ for half day) · H holiday · WO weekly off · A absent."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from attendance.models import AttendanceDay
        from attendance.services import WEEKDAYS, policy
        from employees.models import Employee
        from leaves.models import LeaveRequest
        from leaves.services import employee_holidays

        org = request.user.organization
        y, m = _month(request.query_params)
        first, last = date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])
        today = date.today()
        week = policy(org, "attendance.workdays", ["MON", "TUE", "WED", "THU", "FRI"])
        days = [first + timedelta(d) for d in range(last.day)]
        people = Employee.objects.filter(organization=org, start_date__lte=last).exclude(status__in=["EXITED", "INACTIVE", "PREBOARDING"]).order_by("display_name")
        rows = []
        for e in people:
            att = {d.work_date: d for d in AttendanceDay.objects.filter(employee=e, work_date__range=(first, last))}
            leaves = list(LeaveRequest.objects.filter(employee=e, status="APPROVED", start__lte=last, end__gte=first))
            hol = employee_holidays(e, first, last)
            cells, tally, secs = [], {"P": 0, "WFH": 0, "L": 0, "A": 0}, 0
            for d in days:
                a, lv = att.get(d), next((x for x in leaves if x.start <= d <= x.end), None)
                if d < e.start_date or d > today:
                    code = ""
                elif a:
                    code = "WFH" if a.mode == "WFH" else "P"
                    tally[code] += 1
                    secs += a.work_seconds or 0
                    if lv and lv.half_day:
                        code += f" ½{lv.category}"
                elif d in hol:
                    code = "H"
                elif WEEKDAYS[d.weekday()] not in week:
                    code = "WO"
                elif lv:
                    code = f"½{lv.category}" if lv.half_day else lv.category
                    tally["L"] += 1
                else:
                    code, tally["A"] = "A", tally["A"] + 1
                cells.append(code)
            rows.append([e.employee_code, e.display_name, *cells, tally["P"], tally["WFH"], tally["L"], tally["A"], round(secs / 3600, 1)])
        wb = Workbook()
        header = ["Code", "Name", *[d.strftime("%d %a") for d in days], "Office days", "WFH days", "Leave days", "Absent", "Work hours"]
        ws = _sheet(wb, f"Attendance {first:%b %Y}", header, rows, {1: 10, 2: 24, **{i: 7 for i in range(3, 3 + len(days))}})
        ws.append([])
        ws.append(["Key: P office · WFH work from home · CL/SL/EL leave (½ = half day) · H holiday · WO weekly off · A absent (no check-in, no leave)"])
        return _xlsx(wb, f"attendance-{y}-{m:02d}")


class LeaveReport(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from employees.models import Employee
        from leaves.models import LeaveRequest
        from leaves.services import balances

        org = request.user.organization
        try:
            y = int(request.query_params.get("year") or date.today().year)
        except ValueError:
            raise BusinessRuleError("INVALID_YEAR", "Pick a year.")
        reqs = LeaveRequest.objects.filter(organization=org, start__year=y).select_related("employee").order_by("start")
        wb = Workbook()
        _sheet(wb, f"Requests {y}", ["Code", "Name", "Type", "From", "To", "Half day", "Days", "Status", "Reason", "Decided on", "Note"],
               [[r.employee.employee_code, r.employee.display_name, r.category, r.start, r.end, "Yes" if r.half_day else "", float(r.days), r.get_status_display(),
                 r.reason, r.decided_at.date() if r.decided_at else None, r.decision_note] for r in reqs], {2: 24, 9: 40, 11: 30})
        rows = []
        for e in Employee.objects.filter(organization=org).exclude(status__in=["EXITED", "INACTIVE", "PREBOARDING"]).order_by("display_name"):
            b = balances(e, y)
            rows.append([e.employee_code, e.display_name, *[float(b[c][k]) for c in ("CL", "SL", "EL") for k in ("granted", "used", "pending", "available")]])
        _sheet(wb, f"Balances {y}", ["Code", "Name", *[f"{c} {k}" for c in ("CL", "SL", "EL") for k in ("granted", "used", "pending", "left")]], rows, {2: 24})
        return _xlsx(wb, f"leave-{y}")


class SalaryRegister(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from payroll.models import PayrollRun

        run = PayrollRun.objects.filter(organization=request.user.organization, pk=request.query_params.get("run")).first() if request.query_params.get("run") else None
        if run is None:
            raise BusinessRuleError("NOT_FOUND", "Pick a payroll month.")
        slips = list(run.payslips.select_related("employee"))
        earn = list(dict.fromkeys(x["name"] for s in slips for x in s.data["earnings"]))
        ded = list(dict.fromkeys(x["name"] for s in slips for x in s.data["deductions"]))
        rows = []
        for s in slips:
            d = s.data
            e = {x["name"]: Decimal(x["amount"]) for x in d["earnings"]}
            dd = {x["name"]: Decimal(x["amount"]) for x in d["deductions"]}
            rows.append([d["employee"]["code"], d["employee"]["name"], d["employee"]["designation"], float(d["paid_days"]), float(d["unpaid_days"]),
                         *[float(e.get(n, 0)) for n in earn], float(s.gross), *[float(dd.get(n, 0)) for n in ded], float(s.deductions), float(s.net)])
        rows.append(["", "Total", "", "", "", *[sum(r[5 + i] for r in rows) for i in range(len(earn))], float(sum(s.gross for s in slips)),
                     *[sum(r[6 + len(earn) + i] for r in rows) for i in range(len(ded))], float(sum(s.deductions for s in slips)), float(sum(s.net for s in slips))])
        wb = Workbook()
        ws = _sheet(wb, f"Salary {run.year}-{run.month:02d}", ["Code", "Name", "Designation", "Paid days", "Unpaid days", *earn, "Gross", *ded, "Total deductions", "Net pay"],
                    rows, {2: 24, 3: 24})
        for row in ws.iter_rows(min_row=2, min_col=6):
            for c in row:
                c.number_format = "#,##0.00"
        ws.append([])
        ws.append([f"Status: {run.get_status_display()}" + ("" if run.status != "DRAFT" else " — draft, not final")])
        return _xlsx(wb, f"salary-register-{run.year}-{run.month:02d}")
