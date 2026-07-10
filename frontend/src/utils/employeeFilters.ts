import type { Employee, EmployeeStatus, EmploymentType } from '../types';

export interface EmployeeListFilters {
  search: string;
  department: string;
  designation: string;
  status: EmployeeStatus | '';
  employment_type: EmploymentType | '';
  work_location: string;
}

export const emptyEmployeeListFilters: EmployeeListFilters = {
  search: '',
  department: '',
  designation: '',
  status: '',
  employment_type: '',
  work_location: '',
};

export interface EmployeeFilterOptions {
  departments: string[];
  designations: string[];
  workLocations: string[];
}

export function buildEmployeeFilterOptions(employees: Employee[]): EmployeeFilterOptions {
  const departments = new Set<string>();
  const designations = new Set<string>();
  const workLocations = new Set<string>();

  employees.forEach((employee) => {
    if (employee.department) {
      departments.add(employee.department);
    }
    if (employee.designation) {
      designations.add(employee.designation);
    }
    if (employee.work_location?.trim()) {
      workLocations.add(employee.work_location.trim());
    }
  });

  return {
    departments: Array.from(departments).sort((a, b) => a.localeCompare(b)),
    designations: Array.from(designations).sort((a, b) => a.localeCompare(b)),
    workLocations: Array.from(workLocations).sort((a, b) => a.localeCompare(b)),
  };
}

function matchesSearch(employee: Employee, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const haystack = [
    employee.employee_code,
    employee.first_name,
    employee.last_name,
    employee.full_name,
    employee.email,
    employee.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function filterEmployees(
  employees: Employee[],
  filters: EmployeeListFilters,
): Employee[] {
  return employees.filter((employee) => {
    if (!matchesSearch(employee, filters.search)) {
      return false;
    }
    if (filters.department && employee.department !== filters.department) {
      return false;
    }
    if (filters.designation && employee.designation !== filters.designation) {
      return false;
    }
    if (filters.status && employee.status !== filters.status) {
      return false;
    }
    if (filters.employment_type && employee.employment_type !== filters.employment_type) {
      return false;
    }
    if (filters.work_location && (employee.work_location ?? '').trim() !== filters.work_location) {
      return false;
    }
    return true;
  });
}

export function formatEmployeeDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
