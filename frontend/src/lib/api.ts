// Typed client for the Django API (/api/v1). Session cookie + CSRF header; nothing sensitive in localStorage.

export type ServerRole = 'SUPER_ADMIN' | 'HR_OPERATIONS' | 'EMPLOYEE' | 'REPORTING_MANAGER' | 'INTERVIEWER'

export interface Me {
  id: string
  email: string
  display_name: string
  roles: ServerRole[]
  employee: null | {
    id: string
    employee_code: string | null
    designation: string
    department: string
    status: string
    start_date: string
    probation_end: string
    has_direct_reports: boolean
  }
}

export interface Department { id: string; name: string }
export interface EmployeeDTO {
  id: string
  employee_code: string | null
  display_name: string
  official_email: string
  phone: string
  department: Department
  designation: string
  reporting_manager: { id: string; display_name: string } | null
  employment_type: 'FULL_TIME' | 'INTERN' | 'CONTRACT'
  start_date: string
  probation_months: number
  probation_end: string
  status: 'PREBOARDING' | 'PROBATION' | 'ACTIVE_CONFIRMED' | 'NOTICE_PERIOD' | 'EXITED' | 'INACTIVE'
  roles: ServerRole[]
  address?: string
  emergency_contact?: Record<string, string>
}
export interface Page<T> { count: number; next: string | null; previous: string | null; results: T[] }
export interface AuditEventDTO {
  id: string; created_at: string; actor: string | null; action: string; entity_type: string; entity_id: string
  before: unknown; after: unknown; reason: string; ip_prefix: string; request_id: string
}
export interface PolicyDTO { id: string; key: string; value: unknown; status: string; effective_from: string; created_by: string | null }


// ---------- Attendance (P1) ----------
export type AttState = 'NOT_CHECKED_IN' | 'WORKING' | 'ON_TEA' | 'ON_LUNCH' | 'CHECKED_OUT'
export type ProofStatus = 'VERIFIED' | 'INCONCLUSIVE' | 'FAILED' | 'ADMIN_OVERRIDE'
export interface Thresholds {
  work_seconds: number; presence_seconds: number; tea_remind_seconds: number; tea_exceed_seconds: number
  lunch_remind_seconds: number; lunch_exceed_seconds: number; escalation_after_seconds: number; reverify_interval_seconds: number
}
export interface AttEventDTO { type: string; at: string; proof: string; note: string; by_admin?: boolean; distance_m?: number | null; accuracy_m?: number | null; latitude?: string | null; longitude?: string | null }
export interface TodayDTO {
  day: null | { id: string; work_date: string; status: 'OPEN' | 'CLOSED'; check_in_at: string; check_out_at: string | null; proof: ProofStatus; proof_note: string; review_status: 'NONE' | 'PENDING_REVIEW' | 'REVIEWED'; shortfall_reason: string; stale: boolean }
  state: AttState; server_now: string; thresholds: Thresholds; events: AttEventDTO[]
  work_seconds: number; presence_seconds: number; tea_seconds: number; lunch_seconds: number; tea_count: number
  break_started_at: string | null; is_workday: boolean
}
export interface LocationPayload { location?: { latitude: number; longitude: number; accuracy_m: number } | null; location_error?: string }
export interface HistoryDay {
  id: string; work_date: string; status: 'OPEN' | 'CLOSED'; check_in_at: string; check_out_at: string | null
  work_seconds: number; presence_seconds: number; tea_seconds: number; lunch_seconds: number; tea_count: number
  proof: ProofStatus; review_status: string; shortfall_reason: string; events: AttEventDTO[]
  corrections: { id: string; event_type: string; proposed_at: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; decision_note: string }[]
}
export interface LiveRow {
  employee: { id: string; display_name: string; employee_code: string | null; designation: string; department: string }
  day_id: string | null; state: AttState | 'NOT_ARRIVED'; check_in_at: string | null; check_out_at: string | null
  work_seconds: number; presence_seconds: number; break_started_at: string | null; proof: ProofStatus | null; flags: string[]
}
export interface LiveBoard { server_now: string; work_date: string; counts: Record<'WORKING' | 'ON_TEA' | 'ON_LUNCH' | 'CHECKED_OUT' | 'NOT_ARRIVED' | 'PROOF_REVIEW', number>; rows: LiveRow[]; thresholds: Thresholds }
export interface ExceptionItem {
  kind: 'GEO_FAILED' | 'GEO_INCONCLUSIVE' | 'MISSING_CHECKOUT' | 'SHORTFALL' | 'CORRECTION'; priority: number; title: string
  day_id: string; employee: string; employee_code: string | null; work_date: string
  check_in_at?: string; check_out_at?: string | null; proof?: ProofStatus; proof_note?: string; shortfall_reason?: string; work_seconds?: number
  correction_id?: string; proposed_at?: string; reason?: string
}
export interface AdminDay extends HistoryDay { employee: { display_name: string; employee_code: string | null }; proof_note: string; review_note: string }
export interface OfficeSiteDTO { id: string; name: string; address: string; latitude: string | null; longitude: string | null; radius_m: number }

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors: Record<string, string[]>
  requestId?: string
  constructor(status: number, body: { code?: string; message?: string; field_errors?: Record<string, string[]>; request_id?: string } | null) {
    super(body?.message ?? (status === 0 ? 'Can’t reach the server. Check your connection and try again.' : 'Something went wrong.'))
    this.status = status
    this.code = body?.code ?? (status === 0 ? 'NETWORK' : 'ERROR')
    this.fieldErrors = body?.field_errors ?? {}
    this.requestId = body?.request_id
  }
}

// Same-origin '/api' by default. VITE_API_BASE_URL (e.g. https://api.example.com/api) supports an API on another subdomain.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '') + '/v1'

let csrf = ''
function csrfToken() {
  return csrf || document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.split('=')[1] || ''
}

async function ensureCsrf() {
  if (csrfToken()) return
  const r = await fetch(API_BASE + '/auth/csrf', { credentials: 'include' })
  csrf = ((await r.json().catch(() => ({}))) as { csrf_token?: string }).csrf_token ?? ''
}

export const UNAUTHORIZED_EVENT = 'antro:unauthorized'

async function request<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const write = method !== 'GET'
  if (write) await ensureCsrf()
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method,
      credentials: 'include',
      headers: { ...extraHeaders, Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(write && { 'X-CSRFToken': csrfToken() }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, null)
  }
  if (res.status === 204) {
    if (path === '/auth/logout') csrf = ''
    return undefined as T
  }
  const data = await res.json().catch(() => null)
  if (path === '/auth/login' || path === '/auth/activate') csrf = '' // Django rotates the token on login
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/me') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(res.status, data)
  }
  return data as T
}

const qs = (p: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString()
  return s ? '?' + s : ''
}

export const api = {
  me: () => request<Me>('GET', '/auth/me'),
  login: (email: string, password: string) => request<Me>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  inviteInfo: (token: string) => request<{ email: string; display_name: string; expires_at: string }>('GET', `/auth/activate${qs({ token })}`),
  activate: (token: string, password: string, accept_policy: boolean) => request<Me>('POST', '/auth/activate', { token, password, accept_policy }),
  departments: () => request<Department[]>('GET', '/departments'),
  employees: (p: { q?: string; department?: string; status?: string; page?: string } = {}) => request<Page<EmployeeDTO>>('GET', `/employees${qs(p)}`),
  employee: (id: string) => request<EmployeeDTO>('GET', `/employees/${id}`),
  createEmployee: (body: Record<string, unknown>) => request<EmployeeDTO & { invite_url: string }>('POST', '/employees', body),
  updateEmployee: (id: string, body: Record<string, unknown>) => request<EmployeeDTO>('PATCH', `/employees/${id}`, body),
  resendInvite: (id: string) => request<{ invite_url: string; expires_at: string }>('POST', `/employees/${id}/resend-invite`),
  setRoles: (id: string, roles: ServerRole[]) => request<{ roles: ServerRole[] }>('PUT', `/admin/employees/${id}/roles`, { roles }),
  audit: (p: { action?: string; page?: string } = {}) => request<Page<AuditEventDTO>>('GET', `/admin/audit${qs(p)}`),
  policies: () => request<PolicyDTO[]>('GET', '/admin/policies'),
  // Attendance: every punch carries an Idempotency-Key so double clicks and retries never double-punch.
  today: () => request<TodayDTO>('GET', '/attendance/today'),
  checkIn: (body: LocationPayload, key: string) => request<TodayDTO>('POST', '/attendance/check-in', body, { 'Idempotency-Key': key }),
  startBreak: (kind: 'TEA' | 'LUNCH', key: string) => request<TodayDTO>('POST', '/attendance/break/start', { kind }, { 'Idempotency-Key': key }),
  resumeWork: (key: string) => request<TodayDTO>('POST', '/attendance/break/resume', {}, { 'Idempotency-Key': key }),
  checkOut: (body: LocationPayload & { reason?: string }, key: string) => request<TodayDTO>('POST', '/attendance/check-out', body, { 'Idempotency-Key': key }),
  verifyLocation: (body: LocationPayload) => request<TodayDTO>('POST', '/attendance/verify-location', body),
  history: (month: string) => request<{ month: string; workdays: string[]; days: HistoryDay[] }>('GET', `/attendance/history${qs({ month })}`),
  requestCorrection: (dayId: string, body: { event_type: string; proposed_at: string; reason: string }) => request<{ id: string; status: string }>('POST', `/attendance/days/${dayId}/corrections`, body),
  liveBoard: () => request<LiveBoard>('GET', '/admin/attendance/today'),
  exceptions: () => request<{ items: ExceptionItem[] }>('GET', '/admin/attendance/exceptions'),
  adminDay: (id: string) => request<AdminDay>('GET', `/admin/attendance/days/${id}`),
  reviewDay: (id: string, action: 'ACCEPT_PROOF' | 'ACKNOWLEDGE', note: string) => request<{ ok: true }>('POST', `/admin/attendance/days/${id}/review`, { action, note }),
  decideCorrection: (id: string, decision: 'APPROVE' | 'REJECT', note: string) => request<{ status: string }>('POST', `/admin/attendance/corrections/${id}/decision`, { decision, note }),
  officeSite: () => request<OfficeSiteDTO>('GET', '/admin/office-site'),
  updateOfficeSite: (body: Partial<OfficeSiteDTO>) => request<OfficeSiteDTO>('PATCH', '/admin/office-site', body),
}
