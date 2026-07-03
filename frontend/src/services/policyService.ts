import { apiRequest, apiUpload } from './http';
import type {
  AcknowledgementFilters,
  Policy,
  PolicyAcknowledgement,
  PolicyFormData,
  PolicyPendingSummary,
} from '../types';

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

function toFormData(data: PolicyFormData): FormData {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('category', data.category);
  formData.append('version', data.version);
  formData.append('description', data.description);
  formData.append('effective_date', data.effective_date);
  formData.append('is_active', String(data.is_active));
  if (data.policy_file) {
    formData.append('policy_file', data.policy_file);
  }
  return formData;
}

export const policyService = {
  list(): Promise<Policy[]> {
    return apiRequest<Policy[] | { results: Policy[] }>('/policies/').then(unwrapList);
  },

  get(id: number): Promise<Policy> {
    return apiRequest<Policy>(`/policies/${id}/`);
  },

  create(data: PolicyFormData): Promise<Policy> {
    return apiUpload<Policy>('/policies/', toFormData(data));
  },

  update(id: number, data: PolicyFormData): Promise<Policy> {
    return apiUpload<Policy>(`/policies/${id}/`, toFormData(data), 'PUT');
  },

  patch(id: number, data: Partial<PolicyFormData>): Promise<Policy> {
    const formData = new FormData();
    if (data.title !== undefined) formData.append('title', data.title);
    if (data.category !== undefined) formData.append('category', data.category);
    if (data.version !== undefined) formData.append('version', data.version);
    if (data.description !== undefined) formData.append('description', data.description);
    if (data.effective_date !== undefined) formData.append('effective_date', data.effective_date);
    if (data.is_active !== undefined) formData.append('is_active', String(data.is_active));
    if (data.policy_file) formData.append('policy_file', data.policy_file);
    return apiUpload<Policy>(`/policies/${id}/`, formData, 'PATCH');
  },

  deactivate(id: number): Promise<{ detail: string }> {
    return apiRequest<{ detail: string }>(`/policies/${id}/`, { method: 'DELETE' });
  },

  getMy(status?: string): Promise<Policy[]> {
    const query = status ? `?status=${status}` : '';
    return apiRequest<Policy[]>(`/policies/my/${query}`);
  },

  acknowledge(id: number): Promise<PolicyAcknowledgement> {
    return apiRequest<PolicyAcknowledgement>(`/policies/${id}/acknowledge/`, {
      method: 'POST',
      body: {},
    });
  },

  listAcknowledgements(filters: AcknowledgementFilters = {}): Promise<PolicyAcknowledgement[]> {
    const search = new URLSearchParams();
    if (filters.policy) search.set('policy', String(filters.policy));
    if (filters.employee) search.set('employee', String(filters.employee));
    if (filters.status) search.set('status', filters.status);
    search.set('current_version', filters.current_version === false ? 'false' : 'true');
    const query = search.toString();
    return apiRequest<PolicyAcknowledgement[]>(
      `/policies/acknowledgements/${query ? `?${query}` : ''}`,
    );
  },

  getPendingSummary(): Promise<PolicyPendingSummary> {
    return apiRequest<PolicyPendingSummary>('/policies/pending-summary/');
  },
};
