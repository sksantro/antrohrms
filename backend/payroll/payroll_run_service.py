import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from attendance.models import Attendance
from employees.models import Employee
from leaves.models import LeaveRequest
from leaves.services.working_days import count_working_days
from payroll.models import EmployeePayrollDraft, EmployeePayrollProfile, PayrollRun, SalaryStructure

MISSING_SALARY_REMARK = 'Missing active salary structure'
MISSING_PAYROLL_PROFILE_REMARK = 'Missing active payroll profile'
PRESENT_STATUSES = {
    Attendance.Status.PRESENT,
    Attendance.Status.LATE,
    Attendance.Status.MISSING_CHECKOUT,
}


def get_month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = date(year, month, last_day)
    return start, end


def get_active_salary_structure(employee: Employee, as_of: date) -> SalaryStructure | None:
    return (
        SalaryStructure.objects.filter(
            employee=employee,
            is_active=True,
            effective_from__lte=as_of,
        )
        .order_by('-effective_from', '-created_at')
        .first()
    )


def get_attendance_summary(employee: Employee, start: date, end: date) -> dict:
    records = Attendance.objects.filter(
        employee=employee,
        date__gte=start,
        date__lte=end,
    )
    present_days = Decimal('0')
    absent_days = Decimal('0')
    half_days = Decimal('0')

    for record in records:
        if record.status in PRESENT_STATUSES:
            present_days += Decimal('1')
        elif record.status == Attendance.Status.HALF_DAY:
            half_days += Decimal('1')
            present_days += Decimal('0.5')
        elif record.status == Attendance.Status.ABSENT:
            absent_days += Decimal('1')

    return {
        'present_days': present_days,
        'absent_days': absent_days,
        'half_days': half_days,
    }


def get_leave_summary_for_month(employee: Employee, start: date, end: date) -> dict:
    leaves = LeaveRequest.objects.filter(
        employee=employee,
        status=LeaveRequest.Status.APPROVED,
        start_date__lte=end,
        end_date__gte=start,
    )

    paid_leave_days = Decimal('0')
    lop_days = Decimal('0')

    for leave in leaves:
        overlap_start = max(leave.start_date, start)
        overlap_end = min(leave.end_date, end)
        if overlap_end < overlap_start:
            continue

        overlap_working = count_working_days(overlap_start, overlap_end)
        if leave.total_working_days <= 0:
            continue

        ratio = overlap_working / leave.total_working_days
        paid_leave_days += (leave.paid_leave_days * ratio).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        lop_days += (leave.lop_days * ratio).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    return {
        'paid_leave_days': paid_leave_days,
        'lop_days': lop_days,
    }


def calculate_other_deductions(salary_structure: SalaryStructure) -> Decimal:
    return (
        salary_structure.employee_pf
        + salary_structure.employee_esi
        + salary_structure.professional_tax
        + salary_structure.tds
        + salary_structure.other_deduction
    )


def has_active_payroll_profile(employee: Employee) -> bool:
    try:
        return employee.payroll_profile.is_active
    except EmployeePayrollProfile.DoesNotExist:
        return False


def build_employee_draft(payroll_run: PayrollRun, employee: Employee) -> EmployeePayrollDraft:
    start = payroll_run.start_date
    end = payroll_run.end_date
    total_working_days = count_working_days(start, end)

    attendance = get_attendance_summary(employee, start, end)
    leave_summary = get_leave_summary_for_month(employee, start, end)
    salary_structure = get_active_salary_structure(employee, end)

    draft = EmployeePayrollDraft(
        payroll_run=payroll_run,
        employee=employee,
        salary_structure=salary_structure,
        total_working_days=total_working_days,
        present_days=attendance['present_days'],
        absent_days=attendance['absent_days'],
        half_days=attendance['half_days'],
        paid_leave_days=leave_summary['paid_leave_days'],
        lop_days=leave_summary['lop_days'],
    )

    if not salary_structure:
        draft.monthly_gross_salary = Decimal('0')
        draft.gross_pay = Decimal('0')
        draft.lop_deduction = Decimal('0')
        draft.other_deductions = Decimal('0')
        draft.net_pay = Decimal('0')
        draft.status = EmployeePayrollDraft.Status.MISSING_SALARY_STRUCTURE
        draft.remarks = MISSING_SALARY_REMARK
        return draft

    if not has_active_payroll_profile(employee):
        draft.monthly_gross_salary = Decimal('0')
        draft.gross_pay = Decimal('0')
        draft.lop_deduction = Decimal('0')
        draft.other_deductions = Decimal('0')
        draft.net_pay = Decimal('0')
        draft.status = EmployeePayrollDraft.Status.MISSING_PAYROLL_PROFILE
        draft.remarks = MISSING_PAYROLL_PROFILE_REMARK
        return draft

    monthly_gross = salary_structure.monthly_gross_salary
    other_deductions = calculate_other_deductions(salary_structure)
    per_day_salary = (
        monthly_gross / total_working_days
        if total_working_days > 0
        else Decimal('0')
    )
    lop_deduction = (per_day_salary * draft.lop_days).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    gross_pay = monthly_gross
    net_pay = (gross_pay - lop_deduction - other_deductions).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    draft.monthly_gross_salary = monthly_gross
    draft.gross_pay = gross_pay
    draft.lop_deduction = lop_deduction
    draft.other_deductions = other_deductions
    draft.net_pay = max(net_pay, Decimal('0'))
    draft.status = EmployeePayrollDraft.Status.READY
    draft.remarks = ''
    return draft


@transaction.atomic
def generate_payroll_drafts(payroll_run: PayrollRun, generated_by) -> PayrollRun:
    payroll_run.employee_drafts.all().delete()

    employees = Employee.objects.filter(status=Employee.Status.ACTIVE).order_by('employee_code')
    drafts = [build_employee_draft(payroll_run, employee) for employee in employees]
    EmployeePayrollDraft.objects.bulk_create(drafts)

    payroll_run.total_employees = len(drafts)
    payroll_run.generated_by = generated_by
    payroll_run.generated_at = timezone.now()
    payroll_run.save(update_fields=['total_employees', 'generated_by', 'generated_at', 'updated_at'])
    return payroll_run


def validate_payroll_run_period(month: int, year: int) -> None:
    if month < 1 or month > 12:
        raise ValueError('Month must be between 1 and 12.')
    if year < 2000 or year > 2100:
        raise ValueError('Year is out of allowed range.')

    exists = PayrollRun.objects.filter(
        month=month,
        year=year,
        status__in=[PayrollRun.Status.DRAFT, PayrollRun.Status.LOCKED],
    ).exists()
    if exists:
        raise ValueError('A draft or locked payroll run already exists for this month and year.')
