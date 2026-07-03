import { apiRequest } from './http';
import type {
  AttendanceRegularization,
  LeaveApplyPayload,
  LeaveBalance,
  LeaveRejectPayload,
  LeaveRequest,
  LeaveRequestFilters,
  RegularizationApplyPayload,
} from '../types';

function buildQuery(params: Record<string, string | number | boolean | undefined | ''>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

export const leaveService = {
  getMyBalance(year?: number): Promise<LeaveBalance> {
    const query = year ? `?year=${year}` : '';
    return apiRequest<LeaveBalance>(`/leaves/balance/my/${query}`);
  },

  listBalances(filters: { employee?: number; year?: number } = {}): Promise<LeaveBalance[]> {
    return apiRequest<LeaveBalance[] | { results: LeaveBalance[] }>(
      `/leaves/balances/${buildQuery(filters)}`,
    ).then(unwrapList);
  },

  updateBalance(id: number, paid_leave_balance: number): Promise<LeaveBalance> {
    return apiRequest<LeaveBalance>(`/leaves/balances/${id}/`, {
      method: 'PATCH',
      body: { paid_leave_balance },
    });
  },

  apply(payload: LeaveApplyPayload): Promise<LeaveRequest> {
    return apiRequest<LeaveRequest>('/leaves/apply/', { method: 'POST', body: payload });
  },

  getMyRequests(filters: LeaveRequestFilters = {}): Promise<LeaveRequest[]> {
    const params: Record<string, string | number | boolean | undefined> = { ...filters };
    return apiRequest<LeaveRequest[]>(`/leaves/my-requests/${buildQuery(params)}`);
  },

  listRequests(filters: LeaveRequestFilters = {}): Promise<LeaveRequest[]> {
    const params: Record<string, string | number | boolean | undefined> = { ...filters };
    if (filters.escalated) params.escalated = 'true';
    if (filters.special_approval) params.special_approval = 'true';
    return apiRequest<LeaveRequest[] | { results: LeaveRequest[] }>(
      `/leaves/requests/${buildQuery(params)}`,
    ).then(unwrapList);
  },

  getRequest(id: number): Promise<LeaveRequest> {
    return apiRequest<LeaveRequest>(`/leaves/requests/${id}/`);
  },

  approve(id: number): Promise<LeaveRequest> {
    return apiRequest<LeaveRequest>(`/leaves/requests/${id}/approve/`, { method: 'POST', body: {} });
  },

  reject(id: number, payload: LeaveRejectPayload): Promise<LeaveRequest> {
    return apiRequest<LeaveRequest>(`/leaves/requests/${id}/reject/`, {
      method: 'POST',
      body: payload,
    });
  },

  cancel(id: number): Promise<LeaveRequest> {
    return apiRequest<LeaveRequest>(`/leaves/requests/${id}/cancel/`, { method: 'POST', body: {} });
  },

  requestCancellation(id: number): Promise<LeaveRequest> {
    return apiRequest<LeaveRequest>(`/leaves/requests/${id}/request-cancellation/`, {
      method: 'POST',
      body: {},
    });
  },

  approveCancellation(id: number): Promise<LeaveRequest> {
    return apiRequest<LeaveRequest>(`/leaves/requests/${id}/approve-cancellation/`, {
      method: 'POST',
      body: {},
    });
  },
};

export const regularizationService = {
  apply(payload: RegularizationApplyPayload): Promise<AttendanceRegularization> {
    return apiRequest<AttendanceRegularization>('/attendance/regularization/', {
      method: 'POST',
      body: payload,
    });
  },

  getMy(status?: string): Promise<AttendanceRegularization[]> {
    const query = status ? `?status=${status}` : '';
    return apiRequest<AttendanceRegularization[]>(`/attendance/regularization/my/${query}`);
  },

  list(status?: string): Promise<AttendanceRegularization[]> {
    const query = status ? `?status=${status}` : '';
    return apiRequest<AttendanceRegularization[] | { results: AttendanceRegularization[] }>(
      `/attendance/regularization/${query}`,
    ).then(unwrapList);
  },

  approve(id: number): Promise<AttendanceRegularization> {
    return apiRequest<AttendanceRegularization>(`/attendance/regularization/${id}/approve/`, {
      method: 'POST',
      body: {},
    });
  },

  reject(id: number, rejection_reason: string): Promise<AttendanceRegularization> {
    return apiRequest<AttendanceRegularization>(`/attendance/regularization/${id}/reject/`, {
      method: 'POST',
      body: { rejection_reason },
    });
  },
};
