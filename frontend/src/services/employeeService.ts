import { apiRequest } from './http';
import type { Employee, EmployeeFormData } from '../types';

function toPayload(data: EmployeeFormData, isCreate: boolean) {
  const payload: Record<string, unknown> = {
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    alternate_phone: data.alternate_phone,
    gender: data.gender || undefined,
    date_of_birth: data.date_of_birth || null,
    joining_date: data.joining_date,
    department: data.department,
    designation: data.designation,
    reporting_manager_id: data.reporting_manager_id || null,
    employment_type: data.employment_type,
    work_location: data.work_location,
    status: data.status,
    address: data.address,
    emergency_contact_name: data.emergency_contact_name,
    emergency_contact_phone: data.emergency_contact_phone,
  };

  if (isCreate) {
    payload.email = data.email;
    payload.user_role = data.user_role ?? 'EMPLOYEE';
  }

  return payload;
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

export const employeeService = {
  list(): Promise<Employee[]> {
    return apiRequest<Employee[] | { results: Employee[] }>('/employees/').then(unwrapList);
  },

  get(id: number): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}/`);
  },

  getMyProfile(): Promise<Employee> {
    return apiRequest<Employee>('/employees/me/');
  },

  create(data: EmployeeFormData): Promise<Employee> {
    return apiRequest<Employee>('/employees/', {
      method: 'POST',
      body: toPayload(data, true),
    });
  },

  update(id: number, data: EmployeeFormData): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}/`, {
      method: 'PATCH',
      body: toPayload(data, false),
    });
  },

  delete(id: number): Promise<void> {
    return apiRequest<void>(`/employees/${id}/`, {
      method: 'DELETE',
    });
  },
};
