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
    is_interviewer?: boolean
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
export type ProofStatus = 'VERIFIED' | 'INCONCLUSIVE' | 'FAILED' | 'ADMIN_OVERRIDE' | 'REMOTE'
export type WorkMode = 'WFO' | 'WFH'
export interface Thresholds {
  work_seconds: number; presence_seconds: number; tea_remind_seconds: number; tea_exceed_seconds: number
  lunch_remind_seconds: number; lunch_exceed_seconds: number; escalation_after_seconds: number; reverify_interval_seconds: number
}
export interface AttEventDTO { type: string; at: string; proof: string; note: string; by_admin?: boolean; distance_m?: number | null; accuracy_m?: number | null; latitude?: string | null; longitude?: string | null }
export interface TodayDTO {
  day: null | { id: string; work_date: string; status: 'OPEN' | 'CLOSED'; check_in_at: string; check_out_at: string | null; proof: ProofStatus; proof_note: string; review_status: 'NONE' | 'PENDING_REVIEW' | 'REVIEWED'; shortfall_reason: string; stale: boolean; mode: WorkMode; plan: string; summary: string }
  state: AttState; server_now: string; thresholds: Thresholds; events: AttEventDTO[]
  work_seconds: number; presence_seconds: number; tea_seconds: number; lunch_seconds: number; tea_count: number
  break_started_at: string | null; is_workday: boolean
  wfh: { request: { id: string; status: 'PENDING' | 'APPROVED'; emergency: boolean } | null; used_this_month: number; monthly_limit: number } | null
  presence: null | {
    total: number; answered: number; missed: number
    due: { id: string; due_at: string; expires_at: string } | null
    checks: { due_at: string | null; status: string; responded_at: string | null }[]
  }
}
export interface WfhRequestDTO { id: string; date: string; reason: string; emergency: boolean; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; decision_note: string; decided_at: string | null; created_at: string; used: boolean }
export interface LocationPayload { location?: { latitude: number; longitude: number; accuracy_m: number } | null; location_error?: string }
export interface HistoryDay {
  id: string; work_date: string; status: 'OPEN' | 'CLOSED'; check_in_at: string; check_out_at: string | null
  work_seconds: number; presence_seconds: number; tea_seconds: number; lunch_seconds: number; tea_count: number
  proof: ProofStatus; review_status: string; shortfall_reason: string; events: AttEventDTO[]
  mode: WorkMode; plan: string; summary: string; presence: { total: number; answered: number; missed: number } | null
  corrections: { id: string; event_type: string; proposed_at: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; decision_note: string }[]
}
export interface LiveRow {
  employee: { id: string; display_name: string; employee_code: string | null; designation: string; department: string }
  day_id: string | null; state: AttState | 'NOT_ARRIVED'; check_in_at: string | null; check_out_at: string | null
  work_seconds: number; presence_seconds: number; break_started_at: string | null; proof: ProofStatus | null; flags: string[]; mode: WorkMode | null
}
export interface LiveBoard { server_now: string; work_date: string; counts: Record<'WORKING' | 'ON_TEA' | 'ON_LUNCH' | 'CHECKED_OUT' | 'NOT_ARRIVED' | 'PROOF_REVIEW', number>; rows: LiveRow[]; thresholds: Thresholds }
export interface ExceptionItem {
  kind: 'GEO_FAILED' | 'GEO_INCONCLUSIVE' | 'MISSING_CHECKOUT' | 'SHORTFALL' | 'CORRECTION' | 'WFH_REQUEST' | 'WFH_REVIEW'; priority: number; title: string
  day_id: string; employee: string; employee_code: string | null; work_date: string
  check_in_at?: string; check_out_at?: string | null; proof?: ProofStatus; proof_note?: string; shortfall_reason?: string; work_seconds?: number
  correction_id?: string; proposed_at?: string; reason?: string
  wfh_request_id?: string; emergency?: boolean; used_this_month?: number; plan?: string; summary?: string; presence?: { answered: number; missed: number; total: number }
}
export interface AdminDay extends HistoryDay { employee: { display_name: string; employee_code: string | null }; proof_note: string; review_note: string; presence_checks?: { due_at: string | null; status: string; responded_at: string | null }[] }
export interface ImportRow {
  sheet_row: number; emp_id: string; name: string; login_email: string; email_source: 'COMPANY' | 'PERSONAL' | 'NONE' | ''
  former: boolean; status: EmployeeDTO['status'] | ''; start_date: string | null; department: string; designation: string
  employment_type: string; manager_text: string; manager_name: string; action: 'CREATE' | 'CREATE_FORMER' | 'SKIP'; errors: string[]; warnings: string[]
}
export interface ImportPreview {
  rows: ImportRow[]; ignored_columns: string[]; unmapped_columns: string[]; new_departments: string[]
  summary: { total: number; create_current: number; create_former: number; skipped: number; with_warnings: number }
}
export interface ImportResult { summary: ImportPreview['summary']; new_departments: string[]; invites: { name: string; employee_code: string; login_email: string; invite_url: string }[] }
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
      headers: { ...extraHeaders, Accept: 'application/json', ...(body !== undefined && !(body instanceof FormData) && { 'Content-Type': 'application/json' }), ...(write && { 'X-CSRFToken': csrfToken() }) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
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

// ---------- P2: holidays, leave, payroll ----------
export type HolidayKind = 'FIXED' | 'OPTIONAL'
export interface HolidayDTO { date: string; name: string; kind: HolidayKind; chosen?: boolean }
export interface MyCalendar { year: number; published: boolean; revision: number | null; holidays: HolidayDTO[]; optional_limit: number; optional_chosen: number; today: string }
export interface CalendarDTO {
  id: string; year: number; revision: number; status: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'SUPERSEDED' | 'REJECTED'; note: string; decision_note: string
  created_by: string; decided_at: string | null; created_at: string; holidays: HolidayDTO[]; changes?: { date: string; change: 'ADDED' | 'REMOVED' | 'CHANGED'; name: string; kind: HolidayKind }[]
}
export type LeaveCat = 'CL' | 'SL' | 'EL' | 'CO'
export type LeaveStatusDTO = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES' | 'CANCELLED'
export interface LeaveBalance { name: string; granted: number; used: number; pending: number; available: number; expired?: number; next_expiry?: string | null }
export type HolidayWorkStatus = 'REQUESTED' | 'APPROVED' | 'EMERGENCY' | 'REJECTED' | 'CANCELLED' | 'AWAITING_REVIEW' | 'CREDITED' | 'NOT_CREDITED'
export interface HolidayWorkDTO {
  id: string; work_date: string; day_label: string; title: string; purpose: string; expected_hours: number; emergency: boolean; status: HolidayWorkStatus
  intervals: [string, string | null][]; running: boolean; worked_seconds: number; summary: string; task_refs: string; approved_hours: number | null; units: number | null
  decision_note: string; review_note: string; created_at: string; can_work: boolean; cancellable: boolean
  employee?: { id: string; display_name: string; employee_code: string | null; designation: string }
}
export type CandidateStage = 'NEW' | 'INTERVIEWING' | 'SELECTION_PENDING' | 'SELECTED' | 'REJECTED' | 'OFFERED' | 'OFFER_ACCEPTED' | 'OFFER_DECLINED' | 'WITHDRAWN' | 'JOINED'
export type OfferStatus = 'DRAFT' | 'PENDING_ADMIN' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN'
export type Evaluation = 'GOOD' | 'AVERAGE' | 'NEEDS_IMPROVEMENT' | 'NOT_EVALUATED'
export type Overall = 'RECOMMENDED' | 'NOT_RECOMMENDED' | 'NEXT_ROUND'
export interface PersonRef { id: string; display_name: string; designation: string }
export interface Question { key: string; text: string; weight: number; evidence_required: boolean }
export interface Answer { key: string; rating: number | null; evaluation: Evaluation; remark: string }
export interface RoundDTO {
  id: string; kind: 'TECHNICAL' | 'MANAGER' | 'CULTURE' | 'HR'; kind_name: string; scheduled_at: string; duration_min: number; mode: 'ONLINE' | 'ONSITE'
  meeting_url: string; location: string; status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'; reschedules: number; interviewers: PersonRef[]; template: { code: string; version: number; name: string }
}
export interface FeedbackDTO { id: string; round_id: string; interviewer: PersonRef; revision: number; answers: Answer[]; overall: Overall | ''; comments: string; score: number | null; submitted_at: string | null; amend_reason: string }
export interface OfferDTO {
  id: string; status: OfferStatus; designation: string; department: { id: string; name: string }; employment_type: string; joining_date: string; work_location: string; terms: string
  reporting_manager: PersonRef | null; admin_note: string; expires_at: string | null; approved_at: string | null; responded_at: string | null; decline_reason: string; digest: string; letter: string
  monthly_gross?: string | null
}
export interface CandidateDTO {
  id: string; name: string; email: string; phone: string; role_applied: string; template_code: string; department: { id: string; name: string } | null; source: string
  stage: CandidateStage; has_resume: boolean; decision_note: string; created_at: string; updated_at: string; offer_status: OfferStatus | null
  notes?: string; rounds?: RoundDTO[]; feedback?: FeedbackDTO[]; avg_score?: number | null; offer?: OfferDTO | null
}
export interface AssignedRound extends RoundDTO {
  candidate: { id: string; name: string; role_applied: string; has_resume: boolean; stage: CandidateStage }; my_feedback: FeedbackDTO | null; questions: Question[]; can_submit: boolean
}
export interface RoundIn { kind: RoundDTO['kind']; scheduled_at: string; duration_min: number; mode: RoundDTO['mode']; meeting_url: string; location: string; interviewers: string[] }
export interface OfferIn { designation: string; department: string; employment_type: string; joining_date: string; reporting_manager: string | null; work_location: string; terms: string }
export interface PublicOffer { status: OfferStatus; company: string; candidate: string; designation: string; joining_date: string; expires_at: string | null; letter: string; digest: string; responded_at: string | null }
export type DocStatus = 'UPLOADED' | 'RECEIVED' | 'NEEDS_REUPLOAD' | 'VERIFIED'
export interface DocDTO { id: string; category: string; label: string; status: DocStatus; hr_note: string; file_name: string; size: number; uploaded_at: string; reviewed_at: string | null }
export interface CheckItem { key: string; label: string; done: boolean; by?: string; at?: string }
export interface HireDTO {
  id: string; name: string; email: string; phone: string; stage: CandidateStage; offer: { designation: string; department: string; joining_date: string } | null
  request: { categories: string[]; labels: string[]; link_expires_at: string; link_used: boolean; open: boolean } | null
  documents: DocDTO[]; missing: string[]; checklist: CheckItem[]; joined_at: string | null; employee_id: string | null; employee_code?: string
}
export interface ProbationDue { id: string; display_name: string; designation: string; department: string; start_date: string; probation_end: string }
export interface ProbationReviewDTO {
  id: string; employee: PersonRef; due_on: string; recommendation: 'CONFIRM' | 'EXTEND'; extend_months: number; hr_note: string
  status: 'PENDING_ADMIN' | 'CONFIRMED' | 'EXTENDED' | 'CANCELLED'; admin_note: string; decided_at: string | null; created_at: string
}
export type LetterStatus = 'DRAFT' | 'PENDING_ADMIN' | 'RELEASED' | 'REJECTED'
export interface LetterDTO {
  id: string; kind: string; title: string; status: LetterStatus; employee: { id: string; display_name: string }; note: string; admin_note: string; content: string
  digest: string; released_at: string | null; created_at: string; template_version: number; editable: boolean
}
export interface PortalDTO { name: string; company: string; session_expires_at: string; items: { category: string; label: string; document: DocDTO | null }[] }
export type AssetState = 'AVAILABLE' | 'ASSIGNED' | 'RETURN_PENDING' | 'RETURNED' | 'WRITTEN_OFF'
export interface AllocationDTO {
  id: string; asset: AssetDTO; employee: PersonRef; assigned_at: string; assign_note: string; ack_at: string | null; return_started_at: string | null
  condition: '' | 'GOOD' | 'DAMAGED' | 'MISSING'; return_note: string; hr_ack_at: string | null; emp_ack_at: string | null; emp_agrees: boolean | null; emp_note: string
  disputed: boolean; admin_decision: string; admin_note: string; closed_at: string | null
}
export interface AssetDTO {
  id: string; category: string; category_name: string; make_model: string; tag: string; serial: string; purchase_ref: string; location: string; state: AssetState
  owner: PersonRef | null; created_at: string; cost?: string | null; current?: AllocationDTO | null
}
export type ResignationStatus = 'SUBMITTED' | 'DISCUSSION_REQUESTED' | 'NOTICE_REVISION_REQUESTED' | 'ACCEPTED' | 'WITHDRAWN'
export interface ResignationDTO {
  id: string; employee: PersonRef; reason: string; submitted_on: string; proposed_last_day: string; notice_days: number; short_notice: boolean; letter: string; revision: number
  has_own_letter: boolean; status: ResignationStatus; admin_note: string; accepted_last_day: string | null; decided_at: string | null; history: { revision: number; proposed_last_day: string; at: string }[]
}
export interface SettlementLine { code?: string; name: string; type: 'EARNING' | 'DEDUCTION'; amount: string; note: string; system?: boolean }
export interface ExitDTO {
  id: string; employee: PersonRef; last_working_day: string; checklist: CheckItem[]; status: 'IN_PROGRESS' | 'COMPLETED'; blockers: string[]; assets: AllocationDTO[]
  fnf_status: 'NOT_STARTED' | 'DRAFT' | 'APPROVED'; letters: { id: string; kind: string; status: LetterStatus }[]; completed_at: string | null; can_complete: boolean
  settlement?: { lines: SettlementLine[]; info: { monthly_gross: string | null; paid_days: number; month_days: number; el_available: number; warnings: string[] }; net: string; status: string; approved_at: string | null; digest: string }
}
export interface CompOffRule { active: boolean; full_day_hours: number; half_day_hours: number; expiry_days: number; review_note: string; updated_by?: string | null; effective_from?: string | null }
export interface LeaveDTO {
  id: string; category: LeaveCat; category_name: string; start: string; end: string; half_day: boolean; days: string; reason: string; status: LeaveStatusDTO
  decision_note: string; decided_at: string | null; created_at: string; cancellable: boolean
  employee?: { id: string; display_name: string; employee_code: string | null; designation: string }; balance?: LeaveBalance
}
export interface LeaveIn { category: LeaveCat; start: string; end: string; half_day: boolean; reason: string }
export interface SlipLine { code: string; name: string; amount: string; note?: string }
export interface PayslipDTO {
  id: string; year: number; month: number; status: 'DRAFT' | 'APPROVED' | 'PAID'; gross: string; deductions: string; net: string; digest: string; issued_at: string | null
  data: {
    employer: { name: string }; period: { year: number; month: number; days: number }
    employee: { code: string | null; name: string; designation: string; department: string; joined: string }
    paid_days: string; unpaid_days: string; earnings: SlipLine[]; deductions: SlipLine[]; gross: string; total_deductions: string; net: string
    info: { leave_days: Record<string, number>; attended_days: number; shortfall_days: number }
  }
  employee_id?: string; unpaid_days?: string; adjustments?: { name: string; type: 'EARNING' | 'DEDUCTION'; amount: string; note: string }[]; flags?: string[]
}
export interface PayrollRunDTO {
  id: string; year: number; month: number; status: 'DRAFT' | 'APPROVED' | 'PAID'; warnings: { employee: string; code: string; message: string }[]
  calculated_at: string; approved_at: string | null; paid_at: string | null
  payslips?: PayslipDTO[]; totals?: { gross: string; deductions: string; net: string; count: number }
}

export interface AccessDTO {
  roles: { role: ServerRole; name: string }[]
  matrix: { capability: string; access: Record<string, string> }[]
  people: { id: string; display_name: string; designation: string; employee_code: string | null; roles: { role: ServerRole; source: 'MANUAL' | 'DESIGNATION' | 'REPORTING_LINE' }[] }[]
  designations: { designation: string; roles: ServerRole[]; people: number }[]
}

export interface NotificationDTO { id: string; title: string; body: string; link: string; tone: 'info' | 'success' | 'warning'; read: boolean; created_at: string }
export interface Colleague { id: string; display_name: string; designation: string; department: string; email: string; manager_id: string | null; joined: string }

/** Download an Excel report (cookies carry the session). */
export async function downloadReport(path: string, filename: string) {
  const res = await fetch(API_BASE + path, { credentials: 'include' })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
  const url = URL.createObjectURL(await res.blob())
  const served = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
  const a = Object.assign(document.createElement('a'), { href: url, download: filename.includes('.') || !served ? filename : `${filename}.${served.split('.').pop()}` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const qs = (p: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString()
  return s ? '?' + s : ''
}

export const api = {
  me: () => request<Me>('GET', '/auth/me'),
  login: (email: string, password: string) => request<Me>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  inviteInfo: (token: string) => request<{ email: string; display_name: string; expires_at: string; is_reset: boolean }>('GET', `/auth/activate${qs({ token })}`),
  changePassword: (current_password: string, new_password: string) => request<void>('POST', '/auth/change-password', { current_password, new_password }),
  myProfile: () => request<EmployeeDTO>('GET', '/employees/me'),
  activate: (token: string, password: string, accept_policy: boolean) => request<Me>('POST', '/auth/activate', { token, password, accept_policy }),
  departments: () => request<Department[]>('GET', '/departments'),
  employees: (p: { q?: string; department?: string; status?: string; page?: string; former?: string } = {}) => request<Page<EmployeeDTO>>('GET', `/employees${qs(p)}`),
  employee: (id: string) => request<EmployeeDTO>('GET', `/employees/${id}`),
  createEmployee: (body: Record<string, unknown>) => request<EmployeeDTO & { invite_url: string }>('POST', '/employees', body),
  updateEmployee: (id: string, body: Record<string, unknown>) => request<EmployeeDTO>('PATCH', `/employees/${id}`, body),
  resendInvite: (id: string) => request<{ invite_url: string; expires_at: string; kind: 'invite' | 'reset' }>('POST', `/employees/${id}/resend-invite`),
  setRoles: (id: string, roles: ServerRole[]) => request<{ roles: ServerRole[] }>('PUT', `/admin/employees/${id}/roles`, { roles }),
  audit: (p: { action?: string; page?: string } = {}) => request<Page<AuditEventDTO>>('GET', `/admin/audit${qs(p)}`),
  policies: () => request<PolicyDTO[]>('GET', '/admin/policies'),
  // Attendance: every punch carries an Idempotency-Key so double clicks and retries never double-punch.
  today: () => request<TodayDTO>('GET', '/attendance/today'),
  checkIn: (body: LocationPayload & { mode?: WorkMode; plan?: string; emergency_reason?: string }, key: string) => request<TodayDTO>('POST', '/attendance/check-in', body, { 'Idempotency-Key': key }),
  startBreak: (kind: 'TEA' | 'LUNCH', key: string) => request<TodayDTO>('POST', '/attendance/break/start', { kind }, { 'Idempotency-Key': key }),
  resumeWork: (body: LocationPayload, key: string) => request<TodayDTO>('POST', '/attendance/break/resume', body, { 'Idempotency-Key': key }),
  checkOut: (body: LocationPayload & { reason?: string; summary?: string }, key: string) => request<TodayDTO>('POST', '/attendance/check-out', body, { 'Idempotency-Key': key }),
  confirmPresence: (id: string) => request<TodayDTO>('POST', `/attendance/presence-checks/${id}/confirm`),
  wfhRequests: () => request<{ requests: WfhRequestDTO[]; used_this_month: number; monthly_limit: number }>('GET', '/attendance/wfh-requests'),
  requestWfh: (body: { date: string; reason: string }) => request<WfhRequestDTO>('POST', '/attendance/wfh-requests', body),
  cancelWfh: (id: string) => request<WfhRequestDTO>('POST', `/attendance/wfh-requests/${id}/cancel`),
  decideWfh: (id: string, decision: 'APPROVE' | 'REJECT', note: string) => request<WfhRequestDTO>('POST', `/admin/wfh-requests/${id}/decision`, { decision, note }),
  history: (month: string) => request<{ month: string; workdays: string[]; days: HistoryDay[] }>('GET', `/attendance/history${qs({ month })}`),
  requestCorrection: (dayId: string, body: { event_type: string; proposed_at: string; reason: string }) => request<{ id: string; status: string }>('POST', `/attendance/days/${dayId}/corrections`, body),
  liveBoard: () => request<LiveBoard>('GET', '/admin/attendance/today'),
  exceptions: () => request<{ items: ExceptionItem[] }>('GET', '/admin/attendance/exceptions'),
  adminDay: (id: string) => request<AdminDay>('GET', `/admin/attendance/days/${id}`),
  reviewDay: (id: string, action: 'ACCEPT_PROOF' | 'ACKNOWLEDGE', note: string) => request<{ ok: true }>('POST', `/admin/attendance/days/${id}/review`, { action, note }),
  decideCorrection: (id: string, decision: 'APPROVE' | 'REJECT', note: string) => request<{ status: string }>('POST', `/admin/attendance/corrections/${id}/decision`, { decision, note }),
  officeSite: () => request<OfficeSiteDTO>('GET', '/admin/office-site'),
  updateOfficeSite: (body: Partial<OfficeSiteDTO>) => request<OfficeSiteDTO>('PATCH', '/admin/office-site', body),
  importPreview: (file: File) => { const f = new FormData(); f.append('file', file); f.append('commit', 'false'); return request<ImportPreview>('POST', '/admin/employees/import', f) },
  importCommit: (file: File) => { const f = new FormData(); f.append('file', file); f.append('commit', 'true'); return request<ImportResult>('POST', '/admin/employees/import', f) },
  myCalendar: (year: number) => request<MyCalendar>('GET', `/holidays/calendar?year=${year}`),
  chooseHoliday: (date: string) => request<{ ok: true }>('POST', '/holidays/optional-selections', { date }),
  unchooseHoliday: (date: string) => request<void>('DELETE', `/holidays/optional-selections?date=${date}`),
  calendars: (year: number) => request<{ year: number; calendars: CalendarDTO[] }>('GET', `/hr/holidays/drafts?year=${year}`),
  openDraft: (year: number) => request<CalendarDTO>('POST', `/hr/holidays/drafts?year=${year}`),
  saveDraft: (id: string, holidays: HolidayDTO[], note: string) => request<CalendarDTO>('PUT', `/hr/holidays/drafts/${id}`, { holidays, note }),
  submitDraft: (id: string) => request<CalendarDTO>('POST', `/hr/holidays/drafts/${id}/submit`),
  decideCalendar: (id: string, decision: 'APPROVE' | 'NEEDS_CHANGES', note: string) => request<CalendarDTO>('POST', `/admin/holidays/${id}/decision`, { decision, note }),
  leaveBalances: (year: number) => request<{ year: number; balances: Record<LeaveCat, LeaveBalance>; on_probation: boolean }>('GET', `/leave/balances?year=${year}`),
  leavePreview: (start: string, end: string) => request<{ days: number; holidays: { date: string; name: string }[] }>('GET', `/leave/preview${qs({ start, end })}`),
  myLeave: () => request<{ requests: LeaveDTO[] }>('GET', '/leave/requests'),
  applyLeave: (body: LeaveIn) => request<LeaveDTO>('POST', '/leave/requests', body),
  resubmitLeave: (id: string, body: LeaveIn) => request<LeaveDTO>('PUT', `/leave/requests/${id}`, body),
  cancelLeave: (id: string) => request<LeaveDTO>('POST', `/leave/requests/${id}/cancel`),
  holidayWork: () => request<{ requests: HolidayWorkDTO[]; eligible: { date: string; label: string }[]; balance: LeaveBalance; rule_active: boolean }>('GET', '/holiday-work/requests'),
  requestHolidayWork: (body: { work_date: string; title: string; purpose: string; expected_hours: number; emergency: boolean }) => request<HolidayWorkDTO>('POST', '/holiday-work/requests', body),
  holidayWorkAction: (id: string, action: 'start' | 'pause' | 'stop' | 'cancel', body?: { summary: string; task_refs: string }) => request<HolidayWorkDTO>('POST', `/holiday-work/${id}/${action}`, body),
  adminHolidayWork: (status?: string) => request<{ requests: HolidayWorkDTO[]; rule: CompOffRule }>('GET', `/admin/holiday-work${qs({ status })}`),
  decideHolidayWork: (id: string, decision: 'APPROVE' | 'REJECT' | 'CREDIT' | 'NO_CREDIT', note: string, hours?: number) => request<HolidayWorkDTO>('POST', `/admin/holiday-work/${id}/decision`, { decision, note, hours: hours ?? null }),
  compOffRule: () => request<CompOffRule>('GET', '/admin/holiday-work/rule'),
  setCompOffRule: (body: CompOffRule) => request<CompOffRule>('PUT', '/admin/holiday-work/rule', body),
  candidates: (p: { stage?: string; q?: string } = {}) => request<{ candidates: CandidateDTO[] }>('GET', `/hr/candidates${qs(p)}`),
  candidate: (id: string) => request<CandidateDTO>('GET', `/hr/candidates/${id}`),
  addCandidate: (f: FormData) => request<CandidateDTO>('POST', '/hr/candidates', f),
  updateCandidate: (id: string, f: FormData) => request<CandidateDTO>('PATCH', `/hr/candidates/${id}`, f),
  withdrawCandidate: (id: string, note: string) => request<CandidateDTO>('POST', `/hr/candidates/${id}/withdraw`, { note }),
  scheduleRound: (cid: string, body: RoundIn) => request<RoundDTO>('POST', `/hr/candidates/${cid}/interviews`, body),
  rescheduleRound: (id: string, body: RoundIn) => request<RoundDTO>('PUT', `/hr/interviews/${id}`, body),
  cancelRound: (id: string) => request<RoundDTO>('POST', `/hr/interviews/${id}/cancel`),
  draftOffer: (cid: string, body: OfferIn) => request<OfferDTO>('POST', `/hr/candidates/${cid}/offer`, body),
  offerAction: (id: string, action: 'submit' | 'withdraw', note = '') => request<OfferDTO>('POST', `/hr/offers/${id}/${action}`, { note }),
  assignedInterviews: () => request<{ rounds: AssignedRound[] }>('GET', '/interviews/assigned'),
  saveFeedback: (rid: string, body: { answers: Answer[]; overall: string; comments: string; submit: boolean; amend_reason?: string }) => request<FeedbackDTO>('POST', `/interviews/${rid}/feedback`, body),
  hiring: () => request<{ selection: CandidateDTO[]; offers: CandidateDTO[] }>('GET', '/admin/hiring'),
  decideCandidate: (id: string, decision: 'SELECT' | 'REJECT', note: string) => request<CandidateDTO>('POST', `/admin/candidates/${id}/decision`, { decision, note }),
  decideOffer: (id: string, decision: 'APPROVE' | 'NEEDS_CHANGES', note: string, monthly_gross?: string) => request<OfferDTO>('POST', `/admin/offers/${id}/decision`, { decision, note, monthly_gross: monthly_gross || null }),
  publicOffer: (token: string) => request<PublicOffer>('GET', `/candidate/offers/${token}`),
  respondOffer: (token: string, body: { decision: 'ACCEPT' | 'DECLINE'; signed_name?: string; consent?: boolean; reason?: string }) => request<PublicOffer>('POST', `/candidate/offers/${token}`, body),
  onboarding: () => request<{ hires: HireDTO[]; categories: Record<string, string>; probation_due: ProbationDue[]; probation_reviews: ProbationReviewDTO[] }>('GET', '/hr/onboarding'),
  requestDocs: (cid: string, categories: string[]) => request<HireDTO>('POST', `/hr/onboarding/${cid}/request-documents`, { categories }),
  reviewDoc: (id: string, status: DocStatus, note = '') => request<DocDTO>('POST', `/hr/documents/${id}/review`, { status, note }),
  setCheck: (cid: string, key: string, done: boolean) => request<HireDTO>('POST', `/hr/onboarding/${cid}/checklist`, { key, done }),
  markJoined: (cid: string, official_email: string) => request<HireDTO>('POST', `/hr/onboarding/${cid}/join`, { official_email }),
  startProbationReview: (empId: string, body: { recommendation: 'CONFIRM' | 'EXTEND'; note: string; extend_months?: number }) => request<ProbationReviewDTO>('POST', `/hr/probation/${empId}/review`, body),
  decideProbation: (id: string, body: { decision: 'CONFIRM' | 'EXTEND'; note: string; extend_months?: number }) => request<ProbationReviewDTO>('POST', `/admin/probation/${id}/decision`, body),
  letters: (status?: string) => request<{ letters: LetterDTO[]; kinds: Record<string, string> }>('GET', `/hr/letters${qs({ status })}`),
  draftLetter: (body: Record<string, string>) => request<LetterDTO>('POST', '/hr/letters', body),
  updateLetter: (id: string, body: Record<string, string>) => request<LetterDTO>('PUT', `/letters/${id}`, body),
  submitLetter: (id: string) => request<LetterDTO>('POST', `/hr/letters/${id}/submit`),
  adminLetters: () => request<{ letters: LetterDTO[]; probation: ProbationReviewDTO[] }>('GET', '/admin/letters'),
  decideLetter: (id: string, decision: 'APPROVE' | 'NEEDS_CHANGES' | 'REJECT', note: string) => request<LetterDTO>('POST', `/admin/letters/${id}/decision`, { decision, note }),
  letterTemplates: () => request<{ templates: { kind: string; title: string; version: number; body: string }[]; placeholders: string[]; sensitive: string[] }>('GET', '/admin/letter-templates'),
  saveTemplate: (kind: string, body: string) => request<{ kind: string; version: number; body: string }>('PUT', '/admin/letter-templates', { kind, body }),
  myDocuments: () => request<{ letters: LetterDTO[]; documents: DocDTO[] }>('GET', '/documents/me'),
  portalOtp: (token: string) => request<{ sent_to: string; expires_in_min: number }>('POST', `/candidate/portal/${token}/otp`),
  portalVerify: (token: string, code: string) => request<{ session: string }>('POST', `/candidate/portal/${token}/verify`, { code }),
  portal: (session: string) => request<PortalDTO>('GET', '/candidate/portal/session', undefined, { 'X-Portal-Session': session }),
  portalUpload: (session: string, category: string, file: File) => { const f = new FormData(); f.append('category', category); f.append('file', file); return request<PortalDTO>('POST', '/candidate/portal/session', f, { 'X-Portal-Session': session }) },
  assets: (state?: string) => request<{ assets: AssetDTO[]; categories: Record<string, string> }>('GET', `/hr/assets${qs({ state })}`),
  addAsset: (body: Record<string, string>) => request<AssetDTO>('POST', '/hr/assets', body),
  assignAsset: (id: string, employee: string, note: string) => request<AllocationDTO>('POST', `/hr/assets/${id}/assign`, { employee, note }),
  allocationHR: (id: string, action: 'return-start' | 'return', body: { condition?: string; note?: string } = {}) => request<AllocationDTO>('POST', `/hr/allocations/${id}/${action}`, body),
  myAssets: () => request<{ allocations: AllocationDTO[]; personal: AssetDTO[] }>('GET', '/assets/me'),
  myAllocation: (id: string, action: 'acknowledge' | 'confirm-return', body: { typed?: string; agrees?: boolean; note?: string }) => request<AllocationDTO>('POST', `/allocations/${id}/${action}`, body),
  assetDisputes: () => request<{ disputes: AllocationDTO[] }>('GET', '/admin/allocations/disputes'),
  resolveAllocation: (id: string, decision: 'ACCEPT' | 'WRITE_OFF' | 'RECOVERY_REVIEW', note: string) => request<AllocationDTO>('POST', `/admin/allocations/${id}/resolve`, { decision, note }),
  assetState: (id: string, state: 'AVAILABLE' | 'WRITTEN_OFF', note: string) => request<AssetDTO>('POST', `/admin/assets/${id}/state`, { state, note }),
  myResignation: () => request<{ resignation: ResignationDTO | null; notice_days: number; earliest_full_notice: string; can_submit: boolean }>('GET', '/resignation/me'),
  resignationPreview: (last_day: string, reason: string) => request<{ letter: string; short_notice: boolean }>('GET', `/resignation/preview${qs({ last_day, reason })}`),
  submitResignation: (f: FormData) => request<ResignationDTO>('POST', '/resignation/me', f),
  resignationAction: (id: string, action: 'revise' | 'withdraw', body: { reason?: string; proposed_last_day?: string } = {}) => request<ResignationDTO>('POST', `/resignation/${id}/${action}`, body),
  exits: () => request<{ resignations: ResignationDTO[]; exits: ExitDTO[] }>('GET', '/hr/exits'),
  exitCheck: (id: string, key: string, done: boolean) => request<ExitDTO>('POST', `/hr/exits/${id}/checklist`, { key, done }),
  completeExit: (id: string) => request<ExitDTO>('POST', `/hr/exits/${id}/complete`),
  decideResignation: (id: string, decision: 'ACCEPT' | 'DISCUSSION' | 'NOTICE_REVISION', note: string, last_day?: string) => request<ResignationDTO>('POST', `/admin/resignations/${id}/decision`, { decision, note, last_day }),
  settlement: (id: string) => request<ExitDTO>('GET', `/admin/exits/${id}/settlement`),
  saveSettlement: (id: string, lines: SettlementLine[]) => request<ExitDTO>('PUT', `/admin/exits/${id}/settlement`, { lines }),
  approveSettlement: (id: string) => request<ExitDTO>('POST', `/admin/exits/${id}/settlement/approve`),
  adminLeave: (status?: string) => request<{ requests: LeaveDTO[] }>('GET', `/admin/leave/requests${qs({ status })}`),
  decideLeave: (id: string, decision: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES', note: string) => request<LeaveDTO>('POST', `/admin/leave/requests/${id}/decision`, { decision, note }),
  employeeLeaveBalance: (id: string, year: number) => request<{ balances: Record<LeaveCat, LeaveBalance> }>('GET', `/admin/leave/balances/${id}?year=${year}`),
  payrollRuns: () => request<{ runs: PayrollRunDTO[] }>('GET', '/admin/payroll/runs'),
  calculatePayroll: (year: number, month: number) => request<PayrollRunDTO>('POST', '/admin/payroll/runs', { year, month }),
  payrollRun: (id: string) => request<PayrollRunDTO>('GET', `/admin/payroll/runs/${id}`),
  payrollAction: (id: string, action: 'approve' | 'paid') => request<PayrollRunDTO>('POST', `/admin/payroll/runs/${id}/${action}`),
  adjustPayslip: (id: string, body: { unpaid_days: string; adjustments: NonNullable<PayslipDTO['adjustments']> }) => request<PayslipDTO>('PATCH', `/admin/payroll/payslips/${id}`, body),
  myPayslips: () => request<{ payslips: PayslipDTO[] }>('GET', '/payslips/me'),
  access: () => request<AccessDTO>('GET', '/admin/access'),
  setDesignationRoles: (designation: string, roles: ServerRole[]) => request<{ people_updated: number }>('PUT', '/admin/access/designation-rules', { designation, roles }),
  notifications: () => request<{ unread: number; items: NotificationDTO[] }>('GET', '/notifications'),
  markRead: (id?: string) => request<{ ok: boolean }>('POST', '/notifications', id ? { id } : {}),
  directory: () => request<{ people: Colleague[] }>('GET', '/directory'),
}
