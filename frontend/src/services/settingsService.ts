import { apiRequest } from './http';
import type {
  CompanyHoliday,
  CompanyHolidayPayload,
  CompanySettings,
  CompanySettingsPayload,
  DepartmentMaster,
  DepartmentMasterPayload,
  DesignationMaster,
  DesignationMasterPayload,
  LeaveTypeMaster,
  LeaveTypeMasterPayload,
  PolicyCategoryMaster,
  PolicyCategoryMasterPayload,
} from '../types';

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const settingsService = {
  getCompanySettings(): Promise<CompanySettings> {
    return apiRequest<CompanySettings>('/settings/company/');
  },

  updateCompanySettings(payload: CompanySettingsPayload): Promise<CompanySettings> {
    return apiRequest<CompanySettings>('/settings/company/', {
      method: 'PATCH',
      body: payload,
    });
  },

  listHolidays(year?: number, options?: { active?: boolean; search?: string }): Promise<CompanyHoliday[]> {
    const query = buildQuery({
      year,
      active: options?.active === false ? 'false' : undefined,
      search: options?.search,
    });
    return apiRequest<CompanyHoliday[] | { results: CompanyHoliday[] }>(
      `/settings/holidays/${query}`,
    ).then(unwrapList);
  },

  createHoliday(payload: CompanyHolidayPayload): Promise<CompanyHoliday> {
    return apiRequest<CompanyHoliday>('/settings/holidays/', {
      method: 'POST',
      body: payload,
    });
  },

  updateHoliday(id: number, payload: Partial<CompanyHolidayPayload>): Promise<CompanyHoliday> {
    return apiRequest<CompanyHoliday>(`/settings/holidays/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deactivateHoliday(id: number): Promise<{ detail: string }> {
    return apiRequest<{ detail: string }>(`/settings/holidays/${id}/`, {
      method: 'DELETE',
    });
  },

  toggleHolidayOptional(id: number): Promise<CompanyHoliday> {
    return apiRequest<CompanyHoliday>(`/settings/holidays/${id}/toggle-optional/`, {
      method: 'POST',
      body: {},
    });
  },

  listDepartments(params?: { search?: string; active?: string }): Promise<DepartmentMaster[]> {
    return apiRequest<DepartmentMaster[] | { results: DepartmentMaster[] }>(
      `/settings/departments/${buildQuery(params)}`,
    ).then(unwrapList);
  },

  createDepartment(payload: DepartmentMasterPayload): Promise<DepartmentMaster> {
    return apiRequest<DepartmentMaster>('/settings/departments/', {
      method: 'POST',
      body: payload,
    });
  },

  updateDepartment(id: number, payload: Partial<DepartmentMasterPayload>): Promise<DepartmentMaster> {
    return apiRequest<DepartmentMaster>(`/settings/departments/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  setDepartmentActive(id: number, is_active: boolean): Promise<DepartmentMaster> {
    return apiRequest<DepartmentMaster>(`/settings/departments/${id}/set-active/`, {
      method: 'POST',
      body: { is_active },
    });
  },

  listDesignations(params?: {
    search?: string;
    active?: string;
    department?: number;
  }): Promise<DesignationMaster[]> {
    return apiRequest<DesignationMaster[] | { results: DesignationMaster[] }>(
      `/settings/designations/${buildQuery(params)}`,
    ).then(unwrapList);
  },

  createDesignation(payload: DesignationMasterPayload): Promise<DesignationMaster> {
    return apiRequest<DesignationMaster>('/settings/designations/', {
      method: 'POST',
      body: payload,
    });
  },

  updateDesignation(
    id: number,
    payload: Partial<DesignationMasterPayload>,
  ): Promise<DesignationMaster> {
    return apiRequest<DesignationMaster>(`/settings/designations/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  setDesignationActive(id: number, is_active: boolean): Promise<DesignationMaster> {
    return apiRequest<DesignationMaster>(`/settings/designations/${id}/set-active/`, {
      method: 'POST',
      body: { is_active },
    });
  },

  listLeaveTypes(params?: { search?: string; active?: string }): Promise<LeaveTypeMaster[]> {
    return apiRequest<LeaveTypeMaster[] | { results: LeaveTypeMaster[] }>(
      `/settings/leave-types/${buildQuery(params)}`,
    ).then(unwrapList);
  },

  createLeaveType(payload: LeaveTypeMasterPayload): Promise<LeaveTypeMaster> {
    return apiRequest<LeaveTypeMaster>('/settings/leave-types/', {
      method: 'POST',
      body: payload,
    });
  },

  updateLeaveType(id: number, payload: Partial<LeaveTypeMasterPayload>): Promise<LeaveTypeMaster> {
    return apiRequest<LeaveTypeMaster>(`/settings/leave-types/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  setLeaveTypeActive(id: number, is_active: boolean): Promise<LeaveTypeMaster> {
    return apiRequest<LeaveTypeMaster>(`/settings/leave-types/${id}/set-active/`, {
      method: 'POST',
      body: { is_active },
    });
  },

  listPolicyCategories(params?: {
    search?: string;
    active?: string;
  }): Promise<PolicyCategoryMaster[]> {
    return apiRequest<PolicyCategoryMaster[] | { results: PolicyCategoryMaster[] }>(
      `/settings/policy-categories/${buildQuery(params)}`,
    ).then(unwrapList);
  },

  createPolicyCategory(payload: PolicyCategoryMasterPayload): Promise<PolicyCategoryMaster> {
    return apiRequest<PolicyCategoryMaster>('/settings/policy-categories/', {
      method: 'POST',
      body: payload,
    });
  },

  updatePolicyCategory(
    id: number,
    payload: Partial<PolicyCategoryMasterPayload>,
  ): Promise<PolicyCategoryMaster> {
    return apiRequest<PolicyCategoryMaster>(`/settings/policy-categories/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  setPolicyCategoryActive(id: number, is_active: boolean): Promise<PolicyCategoryMaster> {
    return apiRequest<PolicyCategoryMaster>(`/settings/policy-categories/${id}/set-active/`, {
      method: 'POST',
      body: { is_active },
    });
  },
};
