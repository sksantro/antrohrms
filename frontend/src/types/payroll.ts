export interface SalaryStructure {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  effective_from: string;
  annual_ctc: string | null;
  pf_status: PfStatus;
  monthly_gross_salary: string;
  basic_salary: string;
  hra: string;
  conveyance_allowance: string;
  special_allowance: string;
  other_allowance: string;
  employee_pf: string;
  employee_esi: string;
  professional_tax: string;
  tds: string;
  other_deduction: string;
  is_active: boolean;
  created_by: number | null;
  created_by_name: string | null;
  updated_by: number | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export type PfStatus =
  | 'NOT_APPLICABLE'
  | 'APPLICABLE_EXISTING_UAN'
  | 'APPLICABLE_COMPANY_POLICY'
  | 'APPLICABLE_STATUTORY'
  | 'VOLUNTARY_PF';

export const PF_STATUS_OPTIONS: Array<{ value: PfStatus; label: string }> = [
  { value: 'NOT_APPLICABLE', label: 'Not Applicable — excluded employee' },
  { value: 'APPLICABLE_EXISTING_UAN', label: 'Applicable — employee already has PF/UAN' },
  { value: 'APPLICABLE_COMPANY_POLICY', label: 'Applicable — company policy' },
  { value: 'APPLICABLE_STATUTORY', label: 'Applicable — statutory requirement' },
  { value: 'VOLUNTARY_PF', label: 'Voluntary PF' },
];

export function formatPfStatus(value: PfStatus): string {
  return PF_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export interface SalaryStructurePayload {
  employee: number;
  effective_from: string;
  annual_ctc?: string | null;
  pf_status?: PfStatus;
  monthly_gross_salary: string;
  basic_salary?: string;
  hra?: string;
  conveyance_allowance?: string;
  special_allowance?: string;
  other_allowance?: string;
  employee_pf?: string;
  employee_esi?: string;
  professional_tax?: string;
  tds?: string;
  other_deduction?: string;
  is_active?: boolean;
}

export interface MySalaryStructureResponse {
  salary_structure: SalaryStructure | null;
  message: string | null;
}

export interface SalaryStructureFormData {
  employee: number | '';
  effective_from: string;
  annual_ctc: string;
  pf_status: PfStatus;
  monthly_gross_salary: string;
  basic_salary: string;
  hra: string;
  conveyance_allowance: string;
  special_allowance: string;
  other_allowance: string;
  employee_pf: string;
  employee_esi: string;
  professional_tax: string;
  tds: string;
  other_deduction: string;
  is_active: boolean;
}

export const emptySalaryStructureForm: SalaryStructureFormData = {
  employee: '',
  effective_from: '',
  annual_ctc: '',
  pf_status: 'NOT_APPLICABLE',
  monthly_gross_salary: '',
  basic_salary: '0',
  hra: '0',
  conveyance_allowance: '0',
  special_allowance: '0',
  other_allowance: '0',
  employee_pf: '0',
  employee_esi: '0',
  professional_tax: '0',
  tds: '0',
  other_deduction: '0',
  is_active: true,
};

export function salaryStructureToForm(structure: SalaryStructure): SalaryStructureFormData {
  return {
    employee: structure.employee,
    effective_from: structure.effective_from,
    annual_ctc: structure.annual_ctc ?? '',
    pf_status: structure.pf_status,
    monthly_gross_salary: structure.monthly_gross_salary,
    basic_salary: structure.basic_salary,
    hra: structure.hra,
    conveyance_allowance: structure.conveyance_allowance,
    special_allowance: structure.special_allowance,
    other_allowance: structure.other_allowance,
    employee_pf: structure.employee_pf,
    employee_esi: structure.employee_esi,
    professional_tax: structure.professional_tax,
    tds: structure.tds,
    other_deduction: structure.other_deduction,
    is_active: structure.is_active,
  };
}

export interface SalaryStructureCalculatePayload {
  annual_ctc?: string;
  monthly_gross_salary?: string;
  pf_status?: PfStatus;
  conveyance_allowance?: string;
  other_allowance?: string;
}

export interface SalaryStructureCalculateResult {
  annual_ctc: string;
  monthly_gross_salary: string;
  basic_salary: string;
  hra: string;
  conveyance_allowance: string;
  special_allowance: string;
  other_allowance: string;
  employee_pf: string;
  employee_esi: string;
  professional_tax: string;
  tds: string;
  other_deduction: string;
  pf_status: PfStatus;
}

export type PayrollRunStatus = 'DRAFT' | 'LOCKED' | 'CANCELLED';

export type PayrollDraftStatus =
  | 'MISSING_SALARY_STRUCTURE'
  | 'MISSING_PAYROLL_PROFILE'
  | 'READY';

export const PAYROLL_DRAFT_STATUS_OPTIONS: Array<{ value: PayrollDraftStatus; label: string }> = [
  { value: 'MISSING_SALARY_STRUCTURE', label: 'Missing Salary Structure' },
  { value: 'MISSING_PAYROLL_PROFILE', label: 'Missing Payroll Profile' },
  { value: 'READY', label: 'Ready' },
];

export function formatPayrollDraftStatus(value: PayrollDraftStatus): string {
  return PAYROLL_DRAFT_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export interface EmployeePayrollDraft {
  id: number;
  payroll_run: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  salary_structure: number | null;
  status: PayrollDraftStatus;
  monthly_gross_salary: string;
  total_working_days: string;
  present_days: string;
  paid_leave_days: string;
  lop_days: string;
  absent_days: string;
  half_days: string;
  gross_pay: string;
  lop_deduction: string;
  bonus_amount: string;
  incentive_amount: string;
  reimbursement_amount: string;
  other_deductions: string;
  hold_salary: boolean;
  net_pay: string;
  remarks: string;
  adjustment_remarks: string;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeePayrollDraftUpdatePayload {
  bonus_amount?: string;
  incentive_amount?: string;
  reimbursement_amount?: string;
  other_deductions?: string;
  hold_salary?: boolean;
  adjustment_remarks?: string;
}

export interface EmployeePayrollDraftFormData {
  bonus_amount: string;
  incentive_amount: string;
  reimbursement_amount: string;
  other_deductions: string;
  hold_salary: boolean;
  adjustment_remarks: string;
}

export function draftToForm(draft: EmployeePayrollDraft): EmployeePayrollDraftFormData {
  return {
    bonus_amount: draft.bonus_amount ?? '0',
    incentive_amount: draft.incentive_amount ?? '0',
    reimbursement_amount: draft.reimbursement_amount ?? '0',
    other_deductions: draft.other_deductions ?? '0',
    hold_salary: draft.hold_salary ?? false,
    adjustment_remarks: draft.adjustment_remarks ?? '',
  };
}

export function calculatePreviewNetPay(
  draft: EmployeePayrollDraft,
  form: EmployeePayrollDraftFormData,
): number {
  if (form.hold_salary) return 0;

  const grossPay = Number(draft.gross_pay) || 0;
  const lopDeduction = Number(draft.lop_deduction) || 0;
  const bonus = Number(form.bonus_amount) || 0;
  const incentive = Number(form.incentive_amount) || 0;
  const reimbursement = Number(form.reimbursement_amount) || 0;
  const otherDeductions = Number(form.other_deductions) || 0;

  const net = grossPay + bonus + incentive + reimbursement - lopDeduction - otherDeductions;
  return Math.max(0, Math.round(net * 100) / 100);
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  start_date: string;
  end_date: string;
  status: PayrollRunStatus;
  total_employees: number;
  generated_by: number | null;
  generated_by_name: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
  employee_drafts?: EmployeePayrollDraft[];
}

export interface PayrollRunCreatePayload {
  month: number;
  year: number;
}

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function formatPayrollRunStatus(status: PayrollRunStatus): string {
  const labels: Record<PayrollRunStatus, string> = {
    DRAFT: 'Draft',
    LOCKED: 'Locked',
    CANCELLED: 'Cancelled',
  };
  return labels[status];
}

export function formatPayrollMonthYear(month: number, year: number): string {
  const monthLabel = MONTH_OPTIONS.find((item) => item.value === month)?.label ?? String(month);
  return `${monthLabel} ${year}`;
}

export type TaxRegime = 'OLD' | 'NEW' | 'NOT_DECLARED';

export interface EmployeePayrollProfile {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  pan_number: string;
  aadhaar_last_four: string;
  bank_name: string;
  bank_account_number?: string;
  masked_account_number?: string;
  ifsc_code: string;
  account_holder_name: string;
  uan_number: string;
  pf_number: string;
  esi_number: string;
  tax_regime: TaxRegime;
  is_active: boolean;
  created_by: number | null;
  created_by_name: string | null;
  updated_by: number | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeePayrollProfilePayload {
  employee: number;
  pan_number: string;
  aadhaar_last_four: string;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  uan_number?: string;
  pf_number?: string;
  esi_number?: string;
  tax_regime: TaxRegime;
  is_active?: boolean;
}

export interface EmployeePayrollProfileFormData {
  employee: number | '';
  pan_number: string;
  aadhaar_last_four: string;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  uan_number: string;
  pf_number: string;
  esi_number: string;
  tax_regime: TaxRegime;
  is_active: boolean;
}

export const emptyPayrollProfileForm: EmployeePayrollProfileFormData = {
  employee: '',
  pan_number: '',
  aadhaar_last_four: '',
  bank_name: '',
  bank_account_number: '',
  ifsc_code: '',
  account_holder_name: '',
  uan_number: '',
  pf_number: '',
  esi_number: '',
  tax_regime: 'NOT_DECLARED',
  is_active: true,
};

export const TAX_REGIME_OPTIONS: Array<{ value: TaxRegime; label: string }> = [
  { value: 'OLD', label: 'Old Regime' },
  { value: 'NEW', label: 'New Regime' },
  { value: 'NOT_DECLARED', label: 'Not Declared' },
];

export function payrollProfileToForm(profile: EmployeePayrollProfile): EmployeePayrollProfileFormData {
  return {
    employee: profile.employee,
    pan_number: profile.pan_number,
    aadhaar_last_four: profile.aadhaar_last_four,
    bank_name: profile.bank_name,
    bank_account_number: profile.bank_account_number ?? '',
    ifsc_code: profile.ifsc_code,
    account_holder_name: profile.account_holder_name,
    uan_number: profile.uan_number ?? '',
    pf_number: profile.pf_number ?? '',
    esi_number: profile.esi_number ?? '',
    tax_regime: profile.tax_regime,
    is_active: profile.is_active,
  };
}

export function formatTaxRegime(value: TaxRegime): string {
  return TAX_REGIME_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function validatePayrollProfileForm(form: EmployeePayrollProfileFormData): string | null {
  if (!form.employee) return 'Employee is required.';
  if (!form.pan_number.trim()) return 'PAN number is required.';
  if (!PAN_PATTERN.test(form.pan_number.trim().toUpperCase())) {
    return 'Enter a valid PAN in format ABCDE1234F.';
  }
  if (!/^\d{4}$/.test(form.aadhaar_last_four.trim())) {
    return 'Aadhaar last four must be exactly 4 digits.';
  }
  if (!form.bank_name.trim()) return 'Bank name is required.';
  if (!form.bank_account_number.trim()) return 'Bank account number is required.';
  if (!form.ifsc_code.trim()) return 'IFSC code is required.';
  if (!IFSC_PATTERN.test(form.ifsc_code.trim().toUpperCase())) {
    return 'Enter a valid IFSC code in format ABCD0123456.';
  }
  if (!form.account_holder_name.trim()) return 'Account holder name is required.';
  return null;
}
