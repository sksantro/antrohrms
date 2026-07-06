import { apiRequest, apiUpload } from './http';
import { ApiError } from './http';
import type {
  Lead,
  LeadActivity,
  LeadActivityFormData,
  LeadActivityUpdatePayload,
  LeadActivityAssignee,
  LeadBulkColumnMapping,
  LeadBulkUploadImportResponse,
  LeadBulkUploadParseResponse,
  LeadBulkUploadPreviewResponse,
  LeadChangeStatusPayload,
  LeadContact,
  LeadContactFormData,
  LeadDashboardResponse,
  LeadEditFormData,
  LeadFilters,
  LeadFormData,
  LeadImportHistory,
} from '../types/lead';
import { DUPLICATE_WARNING_MESSAGE } from '../types/lead';

function toLeadPayload(data: LeadFormData) {
  return {
    company_name: data.company_name,
    website: data.website || '',
    country: data.country,
    industry: data.industry,
    company_size: data.company_size || '',
    source: data.source || '',
    service_fit: data.service_fit,
    current_status: data.current_status,
    priority: data.priority,
    remarks: data.remarks,
    next_follow_up_date: data.next_follow_up_date || null,
    ...(data.lead_owner ? { lead_owner: data.lead_owner } : {}),
  };
}

function toEditPayload(data: LeadEditFormData, confirmDuplicate = false) {
  return {
    company_name: data.company_name,
    website: data.website || '',
    country: data.country,
    industry: data.industry,
    company_size: data.company_size || '',
    source: data.source || '',
    service_fit: data.service_fit,
    priority: data.priority,
    remarks: data.remarks,
    next_follow_up_date: data.next_follow_up_date || null,
    ...(data.lead_owner ? { lead_owner: data.lead_owner } : {}),
    confirm_duplicate: confirmDuplicate,
  };
}

function toContactPayload(data: LeadContactFormData) {
  return {
    full_name: data.full_name,
    designation: data.designation,
    department: data.department,
    linkedin_profile_url: data.linkedin_profile_url || '',
    email: data.email || '',
    phone: data.phone,
    location: data.location,
    remarks: data.remarks,
  };
}

function buildQuery(filters: LeadFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.service_fit) params.set('service_fit', filters.service_fit);
  if (filters.country) params.set('country', filters.country);
  if (filters.industry) params.set('industry', filters.industry);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.lead_owner) params.set('lead_owner', String(filters.lead_owner));
  if (filters.created_by) params.set('created_by', String(filters.created_by));
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.next_follow_up_from) params.set('next_follow_up_from', filters.next_follow_up_from);
  if (filters.next_follow_up_to) params.set('next_follow_up_to', filters.next_follow_up_to);
  if (filters.last_activity_from) params.set('last_activity_from', filters.last_activity_from);
  if (filters.last_activity_to) params.set('last_activity_to', filters.last_activity_to);
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();
  return query ? `?${query}` : '';
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

export function isDuplicateWarningError(err: unknown): boolean {
  if (!(err instanceof ApiError)) {
    return false;
  }
  return err.message.includes('duplicate_warning') || err.message.includes(DUPLICATE_WARNING_MESSAGE);
}

export const leadService = {
  getDashboard(): Promise<LeadDashboardResponse> {
    return apiRequest<LeadDashboardResponse>('/leads/dashboard/');
  },

  list(filters: LeadFilters = {}): Promise<Lead[]> {
    return apiRequest<Lead[] | { results: Lead[] }>(`/leads/${buildQuery(filters)}`).then(unwrapList);
  },

  get(id: number): Promise<Lead> {
    return apiRequest<Lead>(`/leads/${id}/`);
  },

  create(data: LeadFormData): Promise<Lead> {
    return apiRequest<Lead>('/leads/', {
      method: 'POST',
      body: toLeadPayload(data),
    });
  },

  update(id: number, data: LeadEditFormData, confirmDuplicate = false): Promise<Lead> {
    return apiRequest<Lead>(`/leads/${id}/`, {
      method: 'PATCH',
      body: toEditPayload(data, confirmDuplicate),
    });
  },

  changeStatus(id: number, payload: LeadChangeStatusPayload): Promise<Lead> {
    return apiRequest<Lead>(`/leads/${id}/change-status/`, {
      method: 'POST',
      body: payload,
    });
  },

  createActivity(leadId: number, data: LeadActivityFormData): Promise<LeadActivity> {
    return apiRequest<LeadActivity>(`/leads/${leadId}/activities/`, {
      method: 'POST',
      body: {
        activity_type: data.activity_type,
        notes: data.notes,
        assigned_to: data.assigned_to || undefined,
        due_date: data.due_date || null,
        priority: data.priority || 'MEDIUM',
        confirm_duplicate: data.confirm_duplicate ?? false,
      },
    });
  },

  updateActivity(leadId: number, activityId: number, payload: LeadActivityUpdatePayload): Promise<LeadActivity> {
    return apiRequest<LeadActivity>(`/leads/${leadId}/activities/${activityId}/`, {
      method: 'PATCH',
      body: payload,
    });
  },

  listActivityAssignees(): Promise<LeadActivityAssignee[]> {
    return apiRequest<LeadActivityAssignee[]>('/leads/activity-assignees/');
  },

  listContacts(leadId: number): Promise<LeadContact[]> {
    return apiRequest<LeadContact[] | { results: LeadContact[] }>(`/leads/${leadId}/contacts/`).then(
      unwrapList,
    );
  },

  createContact(leadId: number, data: LeadContactFormData): Promise<LeadContact> {
    return apiRequest<LeadContact>(`/leads/${leadId}/contacts/`, {
      method: 'POST',
      body: toContactPayload(data),
    });
  },

  updateContact(leadId: number, contactId: number, data: LeadContactFormData): Promise<LeadContact> {
    return apiRequest<LeadContact>(`/leads/${leadId}/contacts/${contactId}/`, {
      method: 'PATCH',
      body: toContactPayload(data),
    });
  },

  deleteContact(leadId: number, contactId: number): Promise<void> {
    return apiRequest<void>(`/leads/${leadId}/contacts/${contactId}/`, {
      method: 'DELETE',
    });
  },

  parseBulkUpload(file: File): Promise<LeadBulkUploadParseResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<LeadBulkUploadParseResponse>('/leads/bulk-upload/parse/', formData);
  },

  previewBulkUpload(payload: {
    upload_id: string;
    sheet_name: string;
    mapping: LeadBulkColumnMapping;
  }): Promise<LeadBulkUploadPreviewResponse> {
    return apiRequest<LeadBulkUploadPreviewResponse>('/leads/bulk-upload/preview/', {
      method: 'POST',
      body: payload,
    });
  },

  importBulkUpload(payload: {
    upload_id: string;
    sheet_name: string;
    mapping: LeadBulkColumnMapping;
    skip_duplicates?: boolean;
  }): Promise<LeadBulkUploadImportResponse> {
    return apiRequest<LeadBulkUploadImportResponse>('/leads/bulk-upload/import/', {
      method: 'POST',
      body: payload,
    });
  },

  listImportHistory(): Promise<LeadImportHistory[]> {
    return apiRequest<LeadImportHistory[]>('/leads/import-history/');
  },
};
