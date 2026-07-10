import { Button, DatePicker, FormSection, Input, Select, Textarea } from '../ui';
import type { Employee, EmployeeFormData } from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { formatEmploymentType, formatStatus } from '../../utils/rbac';

export type EmployeeFormVariant = 'full' | 'hr';

interface EmployeeFormProps {
  form: EmployeeFormData;
  managers: Employee[];
  isEdit?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  allowElevatedRoles?: boolean;
  variant?: EmployeeFormVariant;
  onChange: (form: EmployeeFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EmployeeForm({
  form,
  managers,
  isEdit = false,
  isSubmitting = false,
  error,
  allowElevatedRoles = false,
  variant = 'full',
  onChange,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const isHrVariant = variant === 'hr';

  const update = (field: keyof EmployeeFormData, value: string | number) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <form
      className={`employee-form${isHrVariant ? ' employee-form--hr' : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {error ? <p className="form-error">{error}</p> : null}

      <FormSection title={isHrVariant ? 'Employee Details' : 'Basic Information'}>
        <div className="employee-form-grid">
          <Input
            id="employee_first_name"
            label="First Name"
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            required
          />
          <Input
            id="employee_last_name"
            label="Last Name"
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            required
          />
          <Input
            id="employee_email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
            disabled={isEdit}
          />
          <Input
            id="employee_phone"
            label="Phone"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            required
          />
          {!isEdit ? (
            <Input
              id="employee_code"
              label="Employee Code"
              value={form.employee_code ?? ''}
              onChange={(e) => update('employee_code', e.target.value.toUpperCase())}
              placeholder="Leave blank to auto-generate"
              hint="Optional. Example: ANT-EMP-0001"
            />
          ) : null}
          {!isHrVariant ? (
            <>
              <Select
                id="employee_gender"
                label="Gender"
                value={form.gender}
                onChange={(e) => update('gender', e.target.value)}
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
              <DatePicker
                id="employee_date_of_birth"
                label="Date of Birth"
                value={form.date_of_birth}
                onChange={(value) => update('date_of_birth', value)}
                placeholder="Select birth date"
              />
              {!isEdit ? (
                <Select
                  id="employee_user_role"
                  label="User Role"
                  value={form.user_role}
                  onChange={(e) => update('user_role', e.target.value)}
                >
                  <option value="EMPLOYEE">Employee</option>
                  {allowElevatedRoles ? (
                    <>
                      <option value="MANAGER">Manager</option>
                      <option value="HR_ADMIN">HR Admin</option>
                      <option value="FINANCE">Finance</option>
                    </>
                  ) : null}
                </Select>
              ) : null}
            </>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Job Details">
        <div className="employee-form-grid">
          <DatePicker
            id="employee_joining_date"
            label="Joining Date"
            value={form.joining_date}
            onChange={(value) => update('joining_date', value)}
            placeholder="Select joining date"
            required
          />
          <Select
            id="employee_department"
            label="Department"
            value={form.department}
            onChange={(e) => update('department', e.target.value)}
            required
          >
            <option value="">Select department</option>
            {EMPLOYEE_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </Select>
          <Input
            id="employee_designation"
            label="Designation"
            value={form.designation}
            onChange={(e) => update('designation', e.target.value)}
            required
          />
          <Select
            id="employee_reporting_manager"
            label="Reporting Manager"
            value={String(form.reporting_manager_id)}
            onChange={(e) => update('reporting_manager_id', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">None</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.employee_code} - {manager.first_name} {manager.last_name}
              </option>
            ))}
          </Select>
          <Select
            id="employee_employment_type"
            label="Employment Type"
            value={form.employment_type}
            onChange={(e) => update('employment_type', e.target.value)}
            required
          >
            {(['FULL_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT'] as const).map((type) => (
              <option key={type} value={type}>
                {formatEmploymentType(type)}
              </option>
            ))}
          </Select>
          <Input
            id="employee_work_location"
            label="Work Location"
            value={form.work_location}
            onChange={(e) => update('work_location', e.target.value)}
          />
          <Select
            id="employee_status"
            label="Status"
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            required
          >
            {(['ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED'] as const).map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </Select>
        </div>
      </FormSection>

      {!isHrVariant ? (
        <>
          <FormSection title="Contact Details">
            <div className="employee-form-grid">
              <Input
                id="employee_alternate_phone"
                label="Alternate Phone"
                value={form.alternate_phone}
                onChange={(e) => update('alternate_phone', e.target.value)}
              />
              <Textarea
                id="employee_address"
                label="Address"
                className="employee-form-grid__span-full"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                rows={3}
              />
            </div>
          </FormSection>

          <FormSection title="Emergency Contact">
            <div className="employee-form-grid">
              <Input
                id="employee_emergency_contact_name"
                label="Emergency Contact Name"
                value={form.emergency_contact_name}
                onChange={(e) => update('emergency_contact_name', e.target.value)}
              />
              <Input
                id="employee_emergency_contact_phone"
                label="Emergency Contact Phone"
                value={form.emergency_contact_phone}
                onChange={(e) => update('emergency_contact_phone', e.target.value)}
              />
            </div>
          </FormSection>
        </>
      ) : null}

      <div className="employee-form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
}
