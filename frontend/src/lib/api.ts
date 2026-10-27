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

function csrfToken() {
  return document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.split('=')[1] ?? ''
}

async function ensureCsrf() {
  if (!csrfToken()) await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' })
}

export const UNAUTHORIZED_EVENT = 'antro:unauthorized'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const write = method !== 'GET'
  if (write) await ensureCsrf()
  let res: Response
  try {
    res = await fetch('/api/v1' + path, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(write && { 'X-CSRFToken': csrfToken() }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, null)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
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
  createEmployee: (body: Record<string, unknown>) => request<EmployeeDTO>('POST', '/employees', body),
  updateEmployee: (id: string, body: Record<string, unknown>) => request<EmployeeDTO>('PATCH', `/employees/${id}`, body),
  resendInvite: (id: string) => request<{ ok: true }>('POST', `/employees/${id}/resend-invite`),
  setRoles: (id: string, roles: ServerRole[]) => request<{ roles: ServerRole[] }>('PUT', `/admin/employees/${id}/roles`, { roles }),
  audit: (p: { action?: string; page?: string } = {}) => request<Page<AuditEventDTO>>('GET', `/admin/audit${qs(p)}`),
  policies: () => request<PolicyDTO[]>('GET', '/admin/policies'),
}
