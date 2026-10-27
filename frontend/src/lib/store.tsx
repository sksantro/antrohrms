import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { viewsFor, useAuth } from './auth'
import { APPROVALS, EMPLOYEES, LEAVES, type Approval, type Employee, type LeaveRequest, type Role } from './data'

// ---------- Toasts ----------
export interface Toast { id: number; title: string; body?: string; tone: 'success' | 'error' | 'info' }

interface Store {
  role: Role
  setRole: (r: Role) => void
  views: Role[]
  meId: string
  now: number
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
  // Leave/holiday/payslip pages still run on fixtures until P2; match the fixture person by email.
  const meId = EMPLOYEES.find((e) => e.email === me?.email)?.id ?? me?.id ?? ''
  const isFixturePerson = EMPLOYEES.some((e) => e.id === meId)
  // Demo state is per user so a newly activated person starts with a clean slate.
  const [optional, setOptional] = useState<string[]>(() => load(`optional:${meId}`, isFixturePerson ? ['2026-03-04'] : []))
  const [now, setNow] = useState(Date.now())
  const [leaves, setLeaves] = useState<LeaveRequest[]>(LEAVES)
  const [approvals, setApprovals] = useState<Approval[]>(APPROVALS)
  const [toasts, setToasts] = useState<Toast[]>([])

  // A 1-second clock for live timers; they are re-anchored to server time on every fetch (BRD §4.4).
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])

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
  }), [role, views, meId, now, leaves, optional, approvals, toasts, toast])

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
