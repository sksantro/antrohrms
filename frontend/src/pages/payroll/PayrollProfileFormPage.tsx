import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, FormSection, Input, Select, Toast } from '../../components/ui';
import {
  BankIcon,
  ChevronLeftIcon,
  IdCardIcon,
  LockDotIcon,
  ShieldIcon,
  ToggleIcon,
  UserIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import { payrollService } from '../../services/payrollService';
import type { Employee } from '../../types';
import {
  emptyPayrollProfileForm,
  payrollProfileToForm,
  TAX_REGIME_OPTIONS,
  validatePayrollProfileForm,
} from '../../types/payroll';
import type { EmployeePayrollProfileFormData } from '../../types/payroll';

const BASE_PATH = '/admin/payroll/profiles';

export function PayrollProfileFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<EmployeePayrollProfileFormData>(emptyPayrollProfileForm);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [existingEmployeeIds, setExistingEmployeeIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [employeeList, profileList] = await Promise.all([
          employeeService.list(),
          payrollService.listPayrollProfiles(),
        ]);
        setEmployees(employeeList);
        setExistingEmployeeIds(new Set(profileList.map((profile) => profile.employee)));

        if (isEdit && id) {
          const profile = await payrollService.getPayrollProfile(Number(id));
          setForm(payrollProfileToForm(profile));
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load payroll profile.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id, isEdit]);

  const availableEmployees = isEdit
    ? employees
    : employees.filter((employee) => !existingEmployeeIds.has(employee.id));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validatePayrollProfileForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      employee: Number(form.employee),
      pan_number: form.pan_number.trim().toUpperCase(),
      aadhaar_last_four: form.aadhaar_last_four.trim(),
      bank_name: form.bank_name.trim(),
      bank_account_number: form.bank_account_number.trim(),
      ifsc_code: form.ifsc_code.trim().toUpperCase(),
      account_holder_name: form.account_holder_name.trim(),
      uan_number: form.uan_number.trim(),
      pf_number: form.pf_number.trim(),
      esi_number: form.esi_number.trim(),
      tax_regime: form.tax_regime,
      is_active: form.is_active,
    };

    try {
      if (isEdit && id) {
        const { employee: _employee, ...updatePayload } = payload;
        await payrollService.updatePayrollProfile(Number(id), updatePayload);
        setToast({ message: 'Payroll profile updated successfully.', type: 'success' });
        window.setTimeout(() => navigate(`${BASE_PATH}/${id}`), 600);
      } else {
        const created = await payrollService.createPayrollProfile(payload);
        setToast({ message: 'Payroll profile created successfully.', type: 'success' });
        window.setTimeout(() => navigate(`${BASE_PATH}/${created.id}`), 600);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save payroll profile.');
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
              <h2 className="payroll-title">{isEdit ? 'Edit Payroll Profile' : 'Add Payroll Profile'}</h2>
              <p className="payroll-subtitle">Store confidential payroll identity and bank details.</p>
            </div>
            <Link className="payroll-back" to={isEdit && id ? `${BASE_PATH}/${id}` : BASE_PATH}>
              <ChevronLeftIcon />
              Back
            </Link>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <form className="payroll-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="ui-alert ui-alert--info payroll-modal-note">
              <LockDotIcon />
              <span>These details are confidential and stored securely for payroll processing only.</span>
            </div>

            <FormSection title="Employee" icon={<UserIcon />}>
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
                  {availableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_code} — {employee.first_name} {employee.last_name}
                    </option>
                  ))}
                </Select>
              </div>
            </FormSection>

            <FormSection title="Tax & Identity" icon={<ShieldIcon />}>
              <div className="form-grid">
                <Input
                  id="pan_number"
                  label="PAN Number"
                  value={form.pan_number}
                  onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })}
                  required
                />
                <Input
                  id="aadhaar_last_four"
                  label="Aadhaar Last 4 Digits"
                  value={form.aadhaar_last_four}
                  onChange={(e) => setForm({ ...form, aadhaar_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  maxLength={4}
                  required
                />
                <Select
                  id="tax_regime"
                  label="Tax Regime"
                  value={form.tax_regime}
                  onChange={(e) =>
                    setForm({ ...form, tax_regime: e.target.value as EmployeePayrollProfileFormData['tax_regime'] })
                  }
                >
                  {TAX_REGIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </FormSection>

            <FormSection title="Bank Details" icon={<BankIcon />}>
              <div className="form-grid">
                <Input
                  id="bank_name"
                  label="Bank Name"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  required
                />
                <Input
                  id="bank_account_number"
                  label="Bank Account Number"
                  value={form.bank_account_number}
                  onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
                  required
                />
                <Input
                  id="ifsc_code"
                  label="IFSC Code"
                  value={form.ifsc_code}
                  onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                  required
                />
                <Input
                  id="account_holder_name"
                  label="Account Holder Name"
                  value={form.account_holder_name}
                  onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })}
                  required
                />
              </div>
            </FormSection>

            <FormSection title="Statutory IDs" icon={<IdCardIcon />}>
              <div className="form-grid">
                <Input
                  id="uan_number"
                  label="UAN Number"
                  value={form.uan_number}
                  onChange={(e) => setForm({ ...form, uan_number: e.target.value })}
                />
                <Input
                  id="pf_number"
                  label="PF Number"
                  value={form.pf_number}
                  onChange={(e) => setForm({ ...form, pf_number: e.target.value })}
                />
                <Input
                  id="esi_number"
                  label="ESI Number"
                  value={form.esi_number}
                  onChange={(e) => setForm({ ...form, esi_number: e.target.value })}
                />
              </div>
            </FormSection>

            <FormSection title="Status" icon={<ToggleIcon />}>
              <label className="payroll-check">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <span>Active profile</span>
              </label>
            </FormSection>

            <div className="payroll-form-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => navigate(isEdit && id ? `${BASE_PATH}/${id}` : BASE_PATH)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEdit ? 'Update Profile' : 'Create Profile'}
              </Button>
            </div>
          </form>
        </section>
      </div>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </>
  );
}
