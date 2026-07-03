import { apiRequest } from './http';
import type {
  CompanyHoliday,
  CompanyHolidayPayload,
  CompanySettings,
  CompanySettingsPayload,
} from '../types';

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
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

  listHolidays(year?: number): Promise<CompanyHoliday[]> {
    const query = year ? `?year=${year}` : '';
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
};
