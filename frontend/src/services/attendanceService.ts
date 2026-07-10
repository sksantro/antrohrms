import { apiRequest } from './http';
import type {
  Attendance,
  AttendanceCreatePayload,
  AttendanceFilters,
  AttendanceSummary,
  AttendanceUpdatePayload,
  MyAttendanceResponse,
  SalesCheckOutPayload,
  WorkMode,
} from '../types';

function buildQuery(filters: AttendanceFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.employee) params.set('employee', String(filters.employee));
  if (filters.department) params.set('department', filters.department);
  if (filters.month) params.set('month', String(filters.month));
  if (filters.year) params.set('year', String(filters.year));
  if (filters.date) params.set('date', filters.date);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.regularization_status) {
    params.set('regularization_status', filters.regularization_status);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

export const attendanceService = {
  list(filters: AttendanceFilters = {}): Promise<Attendance[]> {
    return apiRequest<Attendance[] | { results: Attendance[] }>(
      `/attendance/${buildQuery(filters)}`,
    ).then(unwrapList);
  },

  get(id: number): Promise<Attendance> {
    return apiRequest<Attendance>(`/attendance/${id}/`);
  },

  getMy(filters: AttendanceFilters = {}): Promise<MyAttendanceResponse> {
    return apiRequest<MyAttendanceResponse>(`/attendance/my/${buildQuery(filters)}`);
  },

  getSummary(filters: AttendanceFilters = {}): Promise<AttendanceSummary> {
    return apiRequest<AttendanceSummary>(`/attendance/summary/${buildQuery(filters)}`);
  },

  checkIn(workMode: WorkMode): Promise<Attendance> {
    return apiRequest<Attendance>('/attendance/check-in/', {
      method: 'POST',
      body: { work_mode: workMode },
    });
  },

  checkOut(remarksOrPayload: string | SalesCheckOutPayload = ''): Promise<Attendance> {
    const body = typeof remarksOrPayload === 'string'
      ? { remarks: remarksOrPayload }
      : remarksOrPayload;
    return apiRequest<Attendance>('/attendance/check-out/', {
      method: 'POST',
      body,
    });
  },

  create(payload: AttendanceCreatePayload): Promise<Attendance> {
    return apiRequest<Attendance>('/attendance/', {
      method: 'POST',
      body: payload,
    });
  },

  update(id: number, payload: AttendanceUpdatePayload): Promise<Attendance> {
    return apiRequest<Attendance>(`/attendance/${id}/`, {
      method: 'PATCH',
      body: payload,
    });
  },
};
