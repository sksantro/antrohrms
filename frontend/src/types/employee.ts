import type { UserRole } from './auth';

export type EmploymentType = 'FULL_TIME' | 'INTERN' | 'CONTRACT' | 'CONSULTANT';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'RESIGNED' | 'TERMINATED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | '';

export interface ReportingManager {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone: string;
  alternate_phone?: string;
  gender?: Gender;
  date_of_birth?: string | null;
  joining_date: string;
  department: string;
  designation: string;
  reporting_manager?: ReportingManager | null;
  reporting_manager_id?: number | null;
  reporting_manager_name?: string | null;
  employment_type: EmploymentType;
  work_location?: string;
  status: EmployeeStatus;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at?: string;
  updated_at?: string;
  temporary_password?: string;
}

export interface EmployeeFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  gender: Gender;
  date_of_birth: string;
  joining_date: string;
  department: string;
  designation: string;
  reporting_manager_id: number | '';
  employment_type: EmploymentType;
  work_location: string;
  status: EmployeeStatus;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  user_role?: UserRole;
}

export const emptyEmployeeForm: EmployeeFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  alternate_phone: '',
  gender: '',
  date_of_birth: '',
  joining_date: '',
  department: '',
  designation: '',
  reporting_manager_id: '',
  employment_type: 'FULL_TIME',
  work_location: '',
  status: 'ACTIVE',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  user_role: 'EMPLOYEE',
};
