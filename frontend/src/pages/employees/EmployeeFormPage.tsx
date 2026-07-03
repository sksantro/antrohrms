import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmployeeForm } from '../../components/employees/EmployeeForm';
import { TemporaryCredentialsCard } from '../../components/employees/TemporaryCredentialsCard';
import { Card } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import type { Employee, EmployeeFormData } from '../../types';
import { emptyEmployeeForm } from '../../types';
import { getEmployeesBasePath } from '../../utils/rbac';

function employeeToForm(employee: Employee): EmployeeFormData {
  return {
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email,
    phone: employee.phone,
    alternate_phone: employee.alternate_phone ?? '',
    gender: employee.gender ?? '',
    date_of_birth: employee.date_of_birth ?? '',
    joining_date: employee.joining_date,
    department: employee.department,
    designation: employee.designation,
    reporting_manager_id: employee.reporting_manager?.id ?? '',
    employment_type: employee.employment_type,
    work_location: employee.work_location ?? '',
    status: employee.status,
    address: employee.address ?? '',
    emergency_contact_name: employee.emergency_contact_name ?? '',
    emergency_contact_phone: employee.emergency_contact_phone ?? '',
  };
}

interface CreatedCredentials {
  email: string;
  temporaryPassword: string;
  employeeCode: string;
  employeeId: number;
}

export function EmployeeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const isEdit = Boolean(id);
  const basePath = user ? getEmployeesBasePath(user.role) : '/admin/employees';

  const [form, setForm] = useState<EmployeeFormData>(emptyEmployeeForm);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const employeeList = await employeeService.list();
        setManagers(employeeList);

        if (isEdit && id) {
          const employee = await employeeService.get(Number(id));
          setForm(employeeToForm(employee));
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Unable to load employee data.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [id, isEdit]);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (isEdit && id) {
        await employeeService.update(Number(id), form);
        navigate(`${basePath}/${id}`);
      } else {
        const created = await employeeService.create(form);
        if (!created.temporary_password) {
          navigate(`${basePath}/${created.id}`);
          return;
        }
        setCreatedCredentials({
          email: created.email,
          temporaryPassword: created.temporary_password,
          employeeCode: created.employee_code,
          employeeId: created.id,
        });
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save employee.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card wide className="employees-page-card employee-form-page-card">
        <p>Loading...</p>
      </Card>
    );
  }

  if (createdCredentials) {
    return (
      <Card wide className="employees-page-card employee-form-page-card">
        <TemporaryCredentialsCard
          email={createdCredentials.email}
          temporaryPassword={createdCredentials.temporaryPassword}
          employeeCode={createdCredentials.employeeCode}
          onContinue={() => navigate(`${basePath}/${createdCredentials.employeeId}`)}
        />
      </Card>
    );
  }

  return (
    <div className="employees-page">
      <Card wide className="employees-page-card employee-form-page-card">
        <div className="employee-form-page__header">
          <div>
            <h2 className="employee-form-page__title">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
            <p className="employee-form-page__subtitle">
              {isEdit
                ? 'Update employee record and linked user account.'
                : 'Create employee record and linked user account.'}
            </p>
          </div>
        </div>

        <EmployeeForm
          form={form}
          managers={managers}
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          error={error}
          allowElevatedRoles={can('can_assign_elevated_employee_roles')}
          onChange={setForm}
          onSubmit={() => void handleSubmit()}
          onCancel={() => navigate(basePath)}
        />
      </Card>
    </div>
  );
}
