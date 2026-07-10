import { apiRequest, apiUpload } from './http';
import type {
  OnboardingCreatePayload,
  OnboardingFilters,
  OnboardingProfileData,
  OnboardingPublic,
  OnboardingRecord,
} from '../types';

function buildQuery(filters: Partial<OnboardingFilters>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, String(value));
    }
  });
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

export const onboardingService = {
  list(filters: Partial<OnboardingFilters> = {}): Promise<OnboardingRecord[]> {
    return apiRequest<OnboardingRecord[] | { results: OnboardingRecord[] }>(
      `/onboarding/${buildQuery(filters)}`,
    ).then(unwrapList);
  },

  get(id: number): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>(`/onboarding/${id}/`);
  },

  create(data: OnboardingCreatePayload): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>('/onboarding/', {
      method: 'POST',
      body: data,
    });
  },

  sendInvite(id: number): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>(`/onboarding/${id}/send_invite/`, {
      method: 'POST',
      body: {},
    });
  },

  resendInvite(id: number): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>(`/onboarding/${id}/resend_invite/`, {
      method: 'POST',
      body: {},
    });
  },

  startReview(id: number): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>(`/onboarding/${id}/start_review/`, {
      method: 'POST',
      body: {},
    });
  },

  approve(id: number): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>(`/onboarding/${id}/approve/`, {
      method: 'POST',
      body: {},
    });
  },

  reject(id: number, reason: string): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>(`/onboarding/${id}/reject/`, {
      method: 'POST',
      body: { reason },
    });
  },

  complete(id: number): Promise<OnboardingRecord> {
    return apiRequest<OnboardingRecord>(`/onboarding/${id}/complete/`, {
      method: 'POST',
      body: {},
    });
  },

  getPublic(token: string): Promise<OnboardingPublic> {
    return apiRequest<OnboardingPublic>(`/onboarding/public/${token}/`, { auth: false });
  },

  savePublicProfile(
    token: string,
    profileData: OnboardingProfileData,
    educationDetails?: Record<string, string>[],
    employmentHistory?: Record<string, string>[],
  ): Promise<OnboardingPublic> {
    return apiRequest<OnboardingPublic>(`/onboarding/public/${token}/`, {
      method: 'POST',
      auth: false,
      body: {
        action: 'save_profile',
        profile_data: profileData,
        education_details: educationDetails,
        employment_history: employmentHistory,
      },
    });
  },

  uploadPublicDocument(
    token: string,
    documentType: string,
    file: File,
  ): Promise<OnboardingPublic> {
    const formData = new FormData();
    formData.append('action', 'upload_document');
    formData.append('document_type', documentType);
    formData.append('file', file);
    return apiUpload<OnboardingPublic>(`/onboarding/public/${token}/`, formData);
  },

  submitPublic(token: string): Promise<OnboardingPublic> {
    return apiRequest<OnboardingPublic>(`/onboarding/public/${token}/`, {
      method: 'POST',
      auth: false,
      body: { action: 'submit' },
    });
  },
};
