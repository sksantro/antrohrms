import { apiRequest } from './http';
import type {
  EmployeePayrollDraft,
  EmployeePayrollDraftUpdatePayload,
  EmployeePayrollProfile,
  EmployeePayrollProfilePayload,
  MySalaryStructureResponse,
  PayrollRun,
  PayrollRunCreatePayload,
  SalaryStructure,
  SalaryStructureCalculatePayload,
  SalaryStructureCalculateResult,
  SalaryStructurePayload,
} from '../types';

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

export const payrollService = {
  listSalaryStructures(params?: { employee?: number; is_active?: boolean }): Promise<SalaryStructure[]> {
    const search = new URLSearchParams();
    if (params?.employee) search.set('employee', String(params.employee));
    if (params?.is_active !== undefined) search.set('is_active', String(params.is_active));
    const query = search.toString();
    return apiRequest<SalaryStructure[] | { results: SalaryStructure[] }>(
      `/payroll/salary-structures/${query ? `?${query}` : ''}`,
    ).then(unwrapList);
  },

  getSalaryStructure(id: number): Promise<SalaryStructure> {
    return apiRequest<SalaryStructure>(`/payroll/salary-structures/${id}/`);
  },

  createSalaryStructure(payload: SalaryStructurePayload): Promise<SalaryStructure> {
    return apiRequest<SalaryStructure>('/payroll/salary-structures/', {
      method: 'POST',
      body: payload,
    });
  },

  updateSalaryStructure(id: number, payload: Partial<SalaryStructurePayload>): Promise<SalaryStructure> {
    return apiRequest<SalaryStructure>(`/payroll/salary-structures/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  activateSalaryStructure(id: number): Promise<SalaryStructure> {
    return apiRequest<SalaryStructure>(`/payroll/salary-structures/${id}/activate/`, {
      method: 'POST',
      body: {},
    });
  },

  deactivateSalaryStructure(id: number): Promise<SalaryStructure> {
    return apiRequest<SalaryStructure>(`/payroll/salary-structures/${id}/deactivate/`, {
      method: 'POST',
      body: {},
    });
  },

  calculateSalaryStructure(payload: SalaryStructureCalculatePayload): Promise<SalaryStructureCalculateResult> {
    return apiRequest<SalaryStructureCalculateResult>('/payroll/salary-structures/calculate/', {
      method: 'POST',
      body: payload,
    });
  },

  getMySalaryStructure(): Promise<MySalaryStructureResponse> {
    return apiRequest<MySalaryStructureResponse>('/payroll/my-salary-structure/');
  },

  listPayrollRuns(params?: { status?: string; year?: number }): Promise<PayrollRun[]> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.year) search.set('year', String(params.year));
    const query = search.toString();
    return apiRequest<PayrollRun[] | { results: PayrollRun[] }>(
      `/payroll/runs/${query ? `?${query}` : ''}`,
    ).then(unwrapList);
  },

  getPayrollRun(id: number): Promise<PayrollRun> {
    return apiRequest<PayrollRun>(`/payroll/runs/${id}/`);
  },

  createPayrollRun(payload: PayrollRunCreatePayload): Promise<PayrollRun> {
    return apiRequest<PayrollRun>('/payroll/runs/', {
      method: 'POST',
      body: payload,
    });
  },

  regeneratePayrollRun(id: number): Promise<PayrollRun> {
    return apiRequest<PayrollRun>(`/payroll/runs/${id}/regenerate/`, {
      method: 'POST',
      body: {},
    });
  },

  lockPayrollRun(id: number): Promise<PayrollRun> {
    return apiRequest<PayrollRun>(`/payroll/runs/${id}/lock/`, {
      method: 'POST',
      body: {},
    });
  },

  cancelPayrollRun(id: number): Promise<PayrollRun> {
    return apiRequest<PayrollRun>(`/payroll/runs/${id}/cancel/`, {
      method: 'POST',
      body: {},
    });
  },

  updatePayrollDraft(id: number, payload: EmployeePayrollDraftUpdatePayload): Promise<EmployeePayrollDraft> {
    return apiRequest<EmployeePayrollDraft>(`/payroll/drafts/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  listPayrollProfiles(params?: { is_active?: boolean }): Promise<EmployeePayrollProfile[]> {
    const search = new URLSearchParams();
    if (params?.is_active !== undefined) search.set('is_active', String(params.is_active));
    const query = search.toString();
    return apiRequest<EmployeePayrollProfile[] | { results: EmployeePayrollProfile[] }>(
      `/payroll/profiles/${query ? `?${query}` : ''}`,
    ).then(unwrapList);
  },

  getPayrollProfile(id: number): Promise<EmployeePayrollProfile> {
    return apiRequest<EmployeePayrollProfile>(`/payroll/profiles/${id}/`);
  },

  createPayrollProfile(payload: EmployeePayrollProfilePayload): Promise<EmployeePayrollProfile> {
    return apiRequest<EmployeePayrollProfile>('/payroll/profiles/', {
      method: 'POST',
      body: payload,
    });
  },

  updatePayrollProfile(
    id: number,
    payload: Partial<EmployeePayrollProfilePayload>,
  ): Promise<EmployeePayrollProfile> {
    return apiRequest<EmployeePayrollProfile>(`/payroll/profiles/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deactivatePayrollProfile(id: number): Promise<EmployeePayrollProfile> {
    return apiRequest<EmployeePayrollProfile>(`/payroll/profiles/${id}/deactivate/`, {
      method: 'POST',
      body: {},
    });
  },
};
