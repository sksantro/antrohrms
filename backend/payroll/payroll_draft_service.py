from decimal import Decimal, ROUND_HALF_UP

from payroll.models import EmployeePayrollDraft


def recalculate_net_pay(draft: EmployeePayrollDraft) -> Decimal:
    if draft.hold_salary:
        return Decimal('0.00')

    net_pay = (
        draft.gross_pay
        + draft.bonus_amount
        + draft.incentive_amount
        + draft.reimbursement_amount
        - draft.lop_deduction
        - draft.other_deductions
    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    return max(net_pay, Decimal('0.00'))
