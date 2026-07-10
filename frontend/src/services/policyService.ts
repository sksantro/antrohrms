import { apiRequest, apiUpload } from './http';
import type {
  AcknowledgementFilters,
  Policy,
  PolicyAcknowledgement,
  PolicyFilters,
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
  formData.append('policy_content', data.policy_content);
  formData.append('effective_date', data.effective_date);
  formData.append('status', data.status);
  formData.append('applies_to', data.applies_to);
  formData.append('requires_acknowledgement', String(data.requires_acknowledgement));
  formData.append('applies_to_departments', JSON.stringify(data.applies_to_departments));
  formData.append('applies_to_designations', JSON.stringify(data.applies_to_designations));
  formData.append('applies_to_employees', JSON.stringify(data.applies_to_employees));
  if (data.policy_file) {
    formData.append('policy_file', data.policy_file);
  }
  return formData;
}

export const policyService = {
  list(filters: PolicyFilters = {}): Promise<Policy[]> {
    const search = new URLSearchParams();
    if (filters.search) search.set('search', filters.search);
    if (filters.category) search.set('category', filters.category);
    if (filters.status) search.set('status', filters.status);
    if (filters.applies_to) search.set('applies_to', filters.applies_to);
    if (filters.requires_acknowledgement !== '' && filters.requires_acknowledgement !== undefined) {
      search.set('requires_acknowledgement', String(filters.requires_acknowledgement));
    }
    const query = search.toString();
    return apiRequest<Policy[] | { results: Policy[] }>(`/policies/${query ? `?${query}` : ''}`).then(
      unwrapList,
    );
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
    if (data.policy_content !== undefined) formData.append('policy_content', data.policy_content);
    if (data.effective_date !== undefined) formData.append('effective_date', data.effective_date);
    if (data.status !== undefined) formData.append('status', data.status);
    if (data.applies_to !== undefined) formData.append('applies_to', data.applies_to);
    if (data.requires_acknowledgement !== undefined) {
      formData.append('requires_acknowledgement', String(data.requires_acknowledgement));
    }
    if (data.applies_to_departments !== undefined) {
      formData.append('applies_to_departments', JSON.stringify(data.applies_to_departments));
    }
    if (data.applies_to_designations !== undefined) {
      formData.append('applies_to_designations', JSON.stringify(data.applies_to_designations));
    }
    if (data.applies_to_employees !== undefined) {
      formData.append('applies_to_employees', JSON.stringify(data.applies_to_employees));
    }
    if (data.policy_file) formData.append('policy_file', data.policy_file);
    return apiUpload<Policy>(`/policies/${id}/`, formData, 'PATCH');
  },

  deactivate(id: number): Promise<{ detail: string }> {
    return apiRequest<{ detail: string }>(`/policies/${id}/`, { method: 'DELETE' });
  },

  publish(id: number): Promise<Policy> {
    return apiRequest<Policy>(`/policies/${id}/publish/`, { method: 'POST', body: {} });
  },

  unpublish(id: number): Promise<Policy> {
    return apiRequest<Policy>(`/policies/${id}/unpublish/`, { method: 'POST', body: {} });
  },

  archive(id: number): Promise<Policy> {
    return apiRequest<Policy>(`/policies/${id}/archive/`, { method: 'POST', body: {} });
  },

  getMy(status?: string): Promise<Policy[]> {
    const query = status ? `?status=${status}` : '';
    return apiRequest<Policy[]>(`/policies/my/${query}`);
  },

  acknowledge(id: number, confirmationText?: string): Promise<PolicyAcknowledgement> {
    return apiRequest<PolicyAcknowledgement>(`/policies/${id}/acknowledge/`, {
      method: 'POST',
      body: {
        confirmed: true,
        confirmation_text: confirmationText || 'I have read and understood this company policy.',
      },
    });
  },

  listAcknowledgements(filters: AcknowledgementFilters = {}): Promise<PolicyAcknowledgement[]> {
    const search = new URLSearchParams();
    if (filters.policy) search.set('policy', String(filters.policy));
    if (filters.employee) search.set('employee', String(filters.employee));
    if (filters.department) search.set('department', filters.department);
    if (filters.designation) search.set('designation', filters.designation);
    if (filters.search) search.set('search', filters.search);
    if (filters.acknowledged_from) search.set('acknowledged_from', filters.acknowledged_from);
    if (filters.acknowledged_to) search.set('acknowledged_to', filters.acknowledged_to);
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
