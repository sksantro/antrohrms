import { apiRequest } from './http';
import type {
  OfferLetter,
  OfferLetterFilters,
  OfferLetterFormData,
  OfferLetterPublic,
  OfferLetterSendResponse,
} from '../types';

function buildQuery(filters: Partial<OfferLetterFilters>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toPayload(data: OfferLetterFormData) {
  return {
    candidate_name: data.candidate_name,
    email: data.email,
    phone: data.phone,
    department: data.department,
    designation: data.designation,
    reporting_manager_id: data.reporting_manager_id || null,
    work_location: data.work_location,
    joining_date: data.joining_date,
    employment_type: data.employment_type,
    offered_ctc: data.offered_ctc,
    offer_valid_till: data.offer_valid_till,
    terms_and_conditions: data.terms_and_conditions,
    notes: data.notes,
  };
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

export const offerLetterService = {
  list(filters: Partial<OfferLetterFilters> = {}): Promise<OfferLetter[]> {
    return apiRequest<OfferLetter[] | { results: OfferLetter[] }>(
      `/offer-letters/${buildQuery(filters)}`,
    ).then(unwrapList);
  },

  get(id: number): Promise<OfferLetter> {
    return apiRequest<OfferLetter>(`/offer-letters/${id}/`);
  },

  preview(id: number): Promise<OfferLetter> {
    return apiRequest<OfferLetter>(`/offer-letters/${id}/preview/`);
  },

  create(data: OfferLetterFormData): Promise<OfferLetter> {
    return apiRequest<OfferLetter>('/offer-letters/', {
      method: 'POST',
      body: toPayload(data),
    });
  },

  update(id: number, data: OfferLetterFormData): Promise<OfferLetter> {
    return apiRequest<OfferLetter>(`/offer-letters/${id}/`, {
      method: 'PATCH',
      body: toPayload(data),
    });
  },

  delete(id: number): Promise<void> {
    return apiRequest<void>(`/offer-letters/${id}/`, {
      method: 'DELETE',
    });
  },

  send(id: number): Promise<OfferLetterSendResponse> {
    return apiRequest<OfferLetterSendResponse>(`/offer-letters/${id}/send/`, {
      method: 'POST',
      body: {},
    });
  },

  cancel(id: number): Promise<OfferLetter> {
    return apiRequest<OfferLetter>(`/offer-letters/${id}/cancel/`, {
      method: 'POST',
      body: {},
    });
  },

  getPublic(token: string): Promise<OfferLetterPublic> {
    return apiRequest<OfferLetterPublic>(`/offer-letters/public/${token}/`, {
      auth: false,
    });
  },

  respondPublic(token: string, action: 'accept' | 'reject'): Promise<OfferLetterPublic> {
    return apiRequest<OfferLetterPublic>(`/offer-letters/public/${token}/`, {
      method: 'POST',
      body: { action },
      auth: false,
    });
  },
};
