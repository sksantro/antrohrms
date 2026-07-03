import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, DatePicker, FormSection, Input, Select, Toast } from '../../components/ui';
import {
  ChevronLeftIcon,
  CoinsIcon,
  MinusCircleIcon,
  PercentIcon,
  ToggleIcon,
  UserIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import { payrollService } from '../../services/payrollService';
import type { Employee, SalaryStructureFormData } from '../../types';
import {
  emptySalaryStructureForm,
  PF_STATUS_OPTIONS,
  salaryStructureToForm,
} from '../../types/payroll';

const BASE_PATH = '/admin/payroll/salary-structures';

const EARNING_FIELDS: Array<{ id: keyof SalaryStructureFormData; label: string; required?: boolean }> = [
  { id: 'monthly_gross_salary', label: 'Monthly Gross Salary', required: true },
  { id: 'basic_salary', label: 'Basic Salary (50% of gross)' },
  { id: 'hra', label: 'HRA (40% of basic)' },
  { id: 'conveyance_allowance', label: 'Conveyance Allowance' },
  { id: 'special_allowance', label: 'Special Allowance (balance)' },
  { id: 'other_allowance', label: 'Other Allowance' },
];

const DEDUCTION_FIELDS: Array<{ id: keyof SalaryStructureFormData; label: string }> = [
  { id: 'employee_pf', label: 'Employee PF' },
  { id: 'employee_esi', label: 'Employee ESI' },
  { id: 'professional_tax', label: 'Professional Tax (Telangana)' },
  { id: 'tds', label: 'TDS' },
  { id: 'other_deduction', label: 'Other Deduction' },
];

function validateForm(form: SalaryStructureFormData): string | null {
  if (!form.employee) return 'Employee is required.';
  if (!form.effective_from) return 'Effective from date is required.';
  if (!form.monthly_gross_salary) return 'Monthly gross salary is required.';

  const amountFields = [...EARNING_FIELDS, ...DEDUCTION_FIELDS];
  for (const field of amountFields) {
    const value = form[field.id];
    if (typeof value === 'string' && value !== '' && Number(value) < 0) {
      return `${field.label} cannot be negative.`;
    }
  }

  return null;
}

export function SalaryStructureFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<SalaryStructureFormData>(emptySalaryStructureForm);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const employeeList = await employeeService.list();
        setEmployees(employeeList);

        if (isEdit && id) {
          const structure = await payrollService.getSalaryStructure(Number(id));
          setForm(salaryStructureToForm(structure));
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load salary structure.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id, isEdit]);

  const handleCalculate = async () => {
    if (!form.annual_ctc && !form.monthly_gross_salary) {
      setError('Enter annual CTC or monthly gross salary to calculate components.');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const result = await payrollService.calculateSalaryStructure({
        annual_ctc: form.annual_ctc || undefined,
        monthly_gross_salary: form.monthly_gross_salary || undefined,
        pf_status: form.pf_status,
        conveyance_allowance: form.conveyance_allowance || '0',
        other_allowance: form.other_allowance || '0',
      });

      setForm((current) => ({
        ...current,
        annual_ctc: result.annual_ctc,
        pf_status: result.pf_status,
        monthly_gross_salary: result.monthly_gross_salary,
        basic_salary: result.basic_salary,
        hra: result.hra,
        conveyance_allowance: result.conveyance_allowance,
        special_allowance: result.special_allowance,
        other_allowance: result.other_allowance,
        employee_pf: result.employee_pf,
        employee_esi: result.employee_esi,
        professional_tax: result.professional_tax,
        tds: result.tds,
        other_deduction: result.other_deduction,
      }));
      setToast({ message: 'Salary components calculated from CTC rules.', type: 'success' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to calculate salary structure.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      employee: Number(form.employee),
      effective_from: form.effective_from,
      annual_ctc: form.annual_ctc || null,
      pf_status: form.pf_status,
      monthly_gross_salary: form.monthly_gross_salary,
      basic_salary: form.basic_salary || '0',
      hra: form.hra || '0',
      conveyance_allowance: form.conveyance_allowance || '0',
      special_allowance: form.special_allowance || '0',
      other_allowance: form.other_allowance || '0',
      employee_pf: form.employee_pf || '0',
      employee_esi: form.employee_esi || '0',
      professional_tax: form.professional_tax || '0',
      tds: form.tds || '0',
      other_deduction: form.other_deduction || '0',
      is_active: form.is_active,
    };

    try {
      if (isEdit && id) {
        const { employee: _employee, ...updatePayload } = payload;
        await payrollService.updateSalaryStructure(Number(id), updatePayload);
        setToast({ message: 'Salary structure updated successfully.', type: 'success' });
        window.setTimeout(() => navigate(`${BASE_PATH}/${id}`), 600);
      } else {
        const created = await payrollService.createSalaryStructure(payload);
        setToast({ message: 'Salary structure created successfully.', type: 'success' });
        window.setTimeout(() => navigate(`${BASE_PATH}/${created.id}`), 600);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save salary structure.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="muted">Loading...</p>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="payroll-page">
        <section className="payroll-card">
          <div className="payroll-header">
            <div className="payroll-header__text">
              <h2 className="payroll-title">{isEdit ? 'Edit Salary Structure' : 'Add Salary Structure'}</h2>
              <p className="payroll-subtitle">Calculate from annual CTC or enter components manually.</p>
            </div>
            <Link className="payroll-back" to={isEdit && id ? `${BASE_PATH}/${id}` : BASE_PATH}>
              <ChevronLeftIcon />
              Back
            </Link>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <form className="payroll-form" onSubmit={(event) => void handleSubmit(event)}>
            <FormSection title="Employee & Effective Date" icon={<UserIcon />}>
              <div className="form-grid">
                <Select
                  id="employee"
                  label="Employee"
                  value={String(form.employee)}
                  onChange={(e) => setForm({ ...form, employee: e.target.value ? Number(e.target.value) : '' })}
                  disabled={isEdit}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_code} — {employee.first_name} {employee.last_name}
                    </option>
                  ))}
                </Select>
                <DatePicker
                  id="effective_from"
                  label="Effective From"
                  value={form.effective_from}
                  onChange={(value) => setForm({ ...form, effective_from: value })}
                  required
                />
              </div>
            </FormSection>

            <FormSection title="CTC & PF Setup" icon={<PercentIcon />}>
              <div className="ui-alert ui-alert--info payroll-formula">
                <span className="payroll-formula__title">Auto-calculation rules</span>
                Basic = 50% of monthly gross · HRA = 40% of basic · Special allowance = balance · PF depends on
                status · ESI if gross ≤ ₹21,000 · PT ₹200 if gross &gt; ₹20,000 (Telangana) · TDS ₹0 up to ₹5.5 LPA
              </div>
              <div className="form-grid">
                <Input
                  id="annual_ctc"
                  label="Annual CTC (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.annual_ctc}
                  onChange={(e) => setForm({ ...form, annual_ctc: e.target.value })}
                />
                <Input
                  id="monthly_gross_salary_calc"
                  label="Monthly Gross (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_gross_salary}
                  onChange={(e) => setForm({ ...form, monthly_gross_salary: e.target.value })}
                />
                <Select
                  id="pf_status"
                  label="PF Status"
                  value={form.pf_status}
                  onChange={(e) =>
                    setForm({ ...form, pf_status: e.target.value as SalaryStructureFormData['pf_status'] })
                  }
                >
                  {PF_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="payroll-inline-action">
                <Button type="button" variant="secondary" disabled={isCalculating} onClick={() => void handleCalculate()}>
                  {isCalculating ? 'Calculating...' : 'Calculate Components'}
                </Button>
              </div>
            </FormSection>

            <FormSection title="Earnings" icon={<CoinsIcon />}>
              <div className="form-grid">
                {EARNING_FIELDS.map((field) => (
                  <Input
                    key={field.id}
                    id={field.id}
                    label={field.label}
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(form[field.id])}
                    onChange={(e) => setForm({ ...form, [field.id]: e.target.value })}
                    required={field.required}
                  />
                ))}
              </div>
            </FormSection>

            <FormSection title="Deductions" icon={<MinusCircleIcon />}>
              <div className="form-grid">
                {DEDUCTION_FIELDS.map((field) => (
                  <Input
                    key={field.id}
                    id={field.id}
                    label={field.label}
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(form[field.id])}
                    onChange={(e) => setForm({ ...form, [field.id]: e.target.value })}
                  />
                ))}
              </div>
            </FormSection>

            {!isEdit ? (
              <FormSection title="Status" icon={<ToggleIcon />}>
                <label className="payroll-check">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  <span>
                    Set as active salary structure
                    <span className="payroll-check__hint">
                      If active, any existing active structure for this employee will be deactivated.
                    </span>
                  </span>
                </label>
              </FormSection>
            ) : null}

            <div className="payroll-form-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => navigate(isEdit && id ? `${BASE_PATH}/${id}` : BASE_PATH)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEdit ? 'Update Salary Structure' : 'Create Salary Structure'}
              </Button>
            </div>
          </form>
        </section>
      </div>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </>
  );
}
