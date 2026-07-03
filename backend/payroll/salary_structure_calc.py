from decimal import Decimal, ROUND_HALF_UP

MONTHS_IN_YEAR = Decimal('12')
BASIC_RATIO = Decimal('0.50')
HRA_OF_BASIC_RATIO = Decimal('0.40')
PF_WAGE_CEILING = Decimal('15000')
PF_EMPLOYEE_RATE = Decimal('0.12')
ESI_GROSS_LIMIT = Decimal('21000')
ESI_EMPLOYEE_RATE = Decimal('0.0075')
PROFESSIONAL_TAX_THRESHOLD = Decimal('20000')
PROFESSIONAL_TAX_AMOUNT = Decimal('200')
TDS_ANNUAL_THRESHOLD = Decimal('550000')

PF_APPLICABLE_STATUSES = {
    'APPLICABLE_EXISTING_UAN',
    'APPLICABLE_COMPANY_POLICY',
    'APPLICABLE_STATUTORY',
    'VOLUNTARY_PF',
}


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_salary_components(
    *,
    annual_ctc: Decimal | None = None,
    monthly_gross_salary: Decimal | None = None,
    pf_status: str = 'NOT_APPLICABLE',
    conveyance_allowance: Decimal | None = None,
    other_allowance: Decimal | None = None,
) -> dict:
    if monthly_gross_salary is None and annual_ctc is None:
        raise ValueError('Provide annual CTC or monthly gross salary.')

    conveyance = _money(conveyance_allowance or Decimal('0'))
    other_allow = _money(other_allowance or Decimal('0'))

    if monthly_gross_salary is None:
        annual = _money(Decimal(annual_ctc))
        monthly_gross = _money(annual / MONTHS_IN_YEAR)
    else:
        monthly_gross = _money(Decimal(monthly_gross_salary))
        annual = _money(monthly_gross * MONTHS_IN_YEAR)

    basic = _money(monthly_gross * BASIC_RATIO)
    hra = _money(basic * HRA_OF_BASIC_RATIO)
    special = _money(monthly_gross - basic - hra - conveyance - other_allow)
    if special < 0:
        special = Decimal('0.00')

    if pf_status in PF_APPLICABLE_STATUSES:
        pf_wage = min(basic, PF_WAGE_CEILING)
        employee_pf = _money(pf_wage * PF_EMPLOYEE_RATE)
    else:
        employee_pf = Decimal('0.00')

    if monthly_gross <= ESI_GROSS_LIMIT:
        employee_esi = _money(monthly_gross * ESI_EMPLOYEE_RATE)
    else:
        employee_esi = Decimal('0.00')

    professional_tax = (
        PROFESSIONAL_TAX_AMOUNT if monthly_gross > PROFESSIONAL_TAX_THRESHOLD else Decimal('0.00')
    )

    tds = Decimal('0.00') if annual <= TDS_ANNUAL_THRESHOLD else Decimal('0.00')

    return {
        'annual_ctc': annual,
        'monthly_gross_salary': monthly_gross,
        'basic_salary': basic,
        'hra': hra,
        'conveyance_allowance': conveyance,
        'special_allowance': special,
        'other_allowance': other_allow,
        'employee_pf': employee_pf,
        'employee_esi': employee_esi,
        'professional_tax': professional_tax,
        'tds': tds,
        'other_deduction': Decimal('0.00'),
        'pf_status': pf_status,
    }
