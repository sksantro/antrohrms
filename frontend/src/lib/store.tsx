import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { viewsFor, useAuth } from './auth'
import { APPROVALS, EMPLOYEES, LEAVES, type Approval, type Employee, type LeaveRequest, type Role } from './data'

// ---------- Attendance: immutable event ledger + derived summary (BRD §4.2) ----------
export type AttEventType = 'CHECK_IN' | 'START_TEA' | 'END_TEA' | 'START_LUNCH' | 'END_LUNCH' | 'CHECK_OUT'
export interface AttEvent { type: AttEventType; at: number; note?: string }
export type AttState = 'NOT_CHECKED_IN' | 'WORKING' | 'ON_TEA' | 'ON_LUNCH' | 'CHECKED_OUT'

export const WORK_TARGET = 8 * 3600
export const PRESENCE_TARGET = 9 * 3600

export function deriveAttendance(events: AttEvent[], now: number) {
  let state: AttState = 'NOT_CHECKED_IN'
  let checkIn: number | null = null
  let checkOut: number | null = null
  let segStart = 0
  let work = 0, tea = 0, lunch = 0, teaCount = 0
  for (const e of events) {
    const t = e.at
    switch (e.type) {
      case 'CHECK_IN': state = 'WORKING'; checkIn = t; segStart = t; break
      case 'START_TEA': work += t - segStart; segStart = t; state = 'ON_TEA'; teaCount++; break
      case 'START_LUNCH': work += t - segStart; segStart = t; state = 'ON_LUNCH'; break
      case 'END_TEA': tea += t - segStart; segStart = t; state = 'WORKING'; break
      case 'END_LUNCH': lunch += t - segStart; segStart = t; state = 'WORKING'; break
      case 'CHECK_OUT':
        if (state === 'WORKING') work += t - segStart
        if (state === 'ON_TEA') tea += t - segStart
        if (state === 'ON_LUNCH') lunch += t - segStart
        state = 'CHECKED_OUT'; checkOut = t; break
    }
  }
  const open = now - segStart
  const breakElapsed = state === 'ON_TEA' || state === 'ON_LUNCH' ? open : 0
  if (state === 'WORKING') work += open
  if (state === 'ON_TEA') tea += open
  if (state === 'ON_LUNCH') lunch += open
  const presence = checkIn ? (checkOut ?? now) - checkIn : 0
  const s = (ms: number) => Math.max(0, Math.floor(ms / 1000))
  return {
    state, checkIn, checkOut, teaCount,
    work: s(work), tea: s(tea), lunch: s(lunch), presence: s(presence), breakElapsed: s(breakElapsed),
  }
}

function seedEvents(): AttEvent[] {
  const now = Date.now()
  const m = 60_000
  return [
    { type: 'CHECK_IN', at: now - 222 * m },
    { type: 'START_TEA', at: now - 140 * m },
    { type: 'END_TEA', at: now - 128 * m },
  ]
}

// ---------- Toasts ----------
export interface Toast { id: number; title: string; body?: string; tone: 'success' | 'error' | 'info' }

interface Store {
  role: Role
  setRole: (r: Role) => void
  views: Role[]
  meId: string
  now: number
  events: AttEvent[]
  punch: (type: AttEventType, note?: string) => void
  resetDay: () => void
  leaves: LeaveRequest[]
  applyLeave: (l: Omit<LeaveRequest, 'id' | 'status' | 'submitted' | 'empId'>) => void
  cancelLeave: (id: string) => void
  decideLeave: (id: string, ok: boolean) => void
  optional: string[]
  toggleOptional: (date: string) => void
  approvals: Approval[]
  decideApproval: (id: string, ok: boolean) => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('antro:' + key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch { return fallback }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem('antro:' + key, JSON.stringify(v)) } catch { /* demo only */ }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const views = viewsFor(me)
  const [view, setView] = useState<Role | null>(() => load<Role | null>('view', null))
  const role: Role = view && views.includes(view) ? view : views[0] ?? 'EMPLOYEE'
  // Attendance/leave/payslip pages still run on fixtures until P1/P2; match the fixture person by email.
  const meId = EMPLOYEES.find((e) => e.email === me?.email)?.id ?? me?.id ?? ''
  const isFixturePerson = EMPLOYEES.some((e) => e.id === meId)
  // Demo state is per user so a newly activated person starts with a clean day.
  const [events, setEvents] = useState<AttEvent[]>(() => load(`events:${meId}`, isFixturePerson ? seedEvents() : []))
  const [optional, setOptional] = useState<string[]>(() => load(`optional:${meId}`, isFixturePerson ? ['2026-03-04'] : []))
  const [now, setNow] = useState(Date.now())
  const [leaves, setLeaves] = useState<LeaveRequest[]>(LEAVES)
  const [approvals, setApprovals] = useState<Approval[]>(APPROVALS)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Timers re-derive from timestamps every tick and on visibility change (BRD §4.4).
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])

  useEffect(() => save(`events:${meId}`, events), [meId, events])
  useEffect(() => save(`optional:${meId}`, optional), [meId, optional])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((x) => [...x, { ...t, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4200)
  }, [])

  const value = useMemo<Store>(() => ({
    role,
    setRole: (r) => { setView(r); save('view', r) },
    views,
    meId,
    now,
    events,
    punch: (type, note) => setEvents((e) => [...e, { type, at: Date.now(), note }]),
    resetDay: () => setEvents([]),
    leaves,
    applyLeave: (l) => setLeaves((x) => [{ ...l, id: 'l' + Date.now(), empId: meId, status: 'SUBMITTED', submitted: new Date().toISOString().slice(0, 10) }, ...x]),
    cancelLeave: (id) => setLeaves((x) => x.map((l) => (l.id === id ? { ...l, status: 'CANCELLED' } : l))),
    decideLeave: (id, ok) => setLeaves((x) => x.map((l) => (l.id === id ? { ...l, status: ok ? 'ADMIN_APPROVED' : 'ADMIN_REJECTED' } : l))),
    optional,
    toggleOptional: (d) => setOptional((x) => (x.includes(d) ? x.filter((y) => y !== d) : x.length >= 2 ? x : [...x, d])),
    approvals,
    decideApproval: (id) => setApprovals((x) => x.filter((a) => a.id !== id)),
    toasts,
    toast,
    dismissToast: (id) => setToasts((x) => x.filter((y) => y.id !== id)),
  }), [role, views, meId, now, events, leaves, optional, approvals, toasts, toast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

/** The signed-in person: real identity from the server, with fixture-only fields filled for demo pages. */
export function useMe(): Employee {
  const { meId } = useStore()
  const { me } = useAuth()
  const fixture = EMPLOYEES.find((e) => e.id === meId)
  const emp = me?.employee
  const hue = [...(me?.email ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
  return {
    ...(fixture ?? { live: 'NOT_ARRIVED', workMin: 0, hue }),
    id: meId,
    name: me?.display_name ?? '',
    email: me?.email ?? '',
    code: emp?.employee_code ?? '—',
    designation: emp?.designation ?? '',
    department: emp?.department ?? '',
    joined: emp?.start_date ?? '',
    status: (emp?.status ?? 'ACTIVE_CONFIRMED') as Employee['status'],
  }
}
