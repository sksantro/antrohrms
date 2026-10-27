import clsx from 'clsx'
import { AlertCircle, Mail, RefreshCw, Search, Send, ShieldCheck, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Avatar, Card, Drawer, EmptyState, PageHeader, Pill, type Tone } from '../../components/ui'
import { api, ApiError, type Department, type EmployeeDTO, type ServerRole } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fmtDate } from '../../lib/format'
import { useStore } from '../../lib/store'

const STATUS: Record<EmployeeDTO['status'], { label: string; tone: Tone }> = {
  PREBOARDING: { label: 'Preboarding', tone: 'blue' },
  PROBATION: { label: 'Probation', tone: 'amber' },
  ACTIVE_CONFIRMED: { label: 'Active', tone: 'green' },
  NOTICE_PERIOD: { label: 'Notice period', tone: 'red' },
  EXITED: { label: 'Exited', tone: 'gray' },
  INACTIVE: { label: 'Inactive', tone: 'gray' },
}
const ROLE_NAMES: Record<ServerRole, string> = {
  SUPER_ADMIN: 'Super Admin', HR_OPERATIONS: 'HR Operations', REPORTING_MANAGER: 'Reporting Manager', INTERVIEWER: 'Interviewer', EMPLOYEE: 'Employee',
}
const hueOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export default function Directory() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('SUPER_ADMIN')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [dept, setDept] = useState('')
  const [depts, setDepts] = useState<Department[]>([])
  const [rows, setRows] = useState<EmployeeDTO[] | null>(null)
  const [count, setCount] = useState(0)
  const [error, setError] = useState<ApiError | null>(null)
  const [view, setView] = useState<EmployeeDTO | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    setError(null)
    api.employees({ q: dq, department: dept }).then((p) => { setRows(p.results); setCount(p.count) }).catch(setError)
  }, [dq, dept])
  useEffect(load, [load])
  useEffect(() => { api.departments().then(setDepts).catch(() => setDepts([])) }, [])

  return (
    <>
      <PageHeader eyebrow="People" title="Employee Directory" subtitle={rows ? `${count} ${count === 1 ? 'person' : 'people'}${dq || dept ? ' match' : ` across ${depts.length} departments`}` : 'Loading…'}
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><UserPlus size={17} /> Add employee</button>} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-10" placeholder="Search name, code or role" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" />
          {q && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" onClick={() => setQ('')} aria-label="Clear search"><X size={15} /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: '', name: 'All' }, ...depts].map((d) => (
            <button key={d.id} onClick={() => setDept(d.id)} className={clsx('h-9 px-3.5 rounded-full text-[13px] font-semibold transition', dept === d.id ? 'bg-ink-900 text-white' : 'bg-white ring-1 ring-ink-200 text-ink-600 hover:ring-ink-300')}>{d.name}</button>
          ))}
        </div>
      </div>

      {error ? (
        <Card><EmptyState icon={AlertCircle} title="Couldn’t load the directory" body={`${error.message}${error.requestId ? ` (ref ${error.requestId})` : ''}`} action={<button className="btn-outline" onClick={load}><RefreshCw size={15} /> Try again</button>} /></Card>
      ) : rows === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => <Card key={i} className="p-5 h-[168px]"><div className="size-12 rounded-full bg-ink-100 animate-pulse" /><div className="h-4 w-2/3 bg-ink-100 rounded mt-4 animate-pulse" /><div className="h-3 w-1/2 bg-ink-100 rounded mt-2 animate-pulse" /></Card>)}
        </div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Search} title="No one matches" body="Try a different name or clear the filters." /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {rows.map((e, i) => (
            <Card key={e.id} role="button" tabIndex={0} aria-label={`Open ${e.display_name}`} className="p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all cursor-pointer animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              onClick={() => setView(e)} onKeyDown={(k) => k.key === 'Enter' && setView(e)}>
              <div className="flex items-start justify-between">
                <Avatar name={e.display_name} hue={hueOf(e.official_email)} size={48} />
                <Pill tone={STATUS[e.status].tone} dot>{STATUS[e.status].label}</Pill>
              </div>
              <div className="mt-4 font-semibold text-[15px] text-ink-900">{e.display_name}</div>
              <div className="text-[13px] text-ink-500">{e.designation}</div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-100 text-[12px] text-ink-400">
                <span>{e.department.name}</span><span className="tabular-nums">{e.employee_code ?? 'Code on joining'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProfileDrawer emp={view} isAdmin={isAdmin} onClose={() => setView(null)} onChanged={(e) => { setView(e); load() }} />
      <AddEmployeeDrawer open={adding} isAdmin={isAdmin} depts={depts} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); load() }} />
    </>
  )
}

function ProfileDrawer({ emp, isAdmin, onClose, onChanged }: { emp: EmployeeDTO | null; isAdmin: boolean; onClose: () => void; onChanged: (e: EmployeeDTO) => void }) {
  const { toast } = useStore()
  const { me } = useAuth()
  const [roles, setRoles] = useState<ServerRole[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (emp) setRoles(emp.roles) }, [emp])
  if (!emp) return <Drawer open={false} onClose={onClose} title=""><></></Drawer>
  const dirty = [...roles].sort().join() !== [...emp.roles].sort().join()

  const saveRoles = async () => {
    setBusy(true)
    try {
      const r = await api.setRoles(emp.id, roles)
      onChanged({ ...emp, roles: r.roles })
      toast({ tone: 'success', title: 'Roles updated', body: 'Change recorded in the audit trail.' })
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t update roles', body: e instanceof ApiError ? e.message : undefined })
    } finally { setBusy(false) }
  }
  const resend = async () => {
    try { await api.resendInvite(emp.id); toast({ tone: 'success', title: 'Invite sent again', body: `New link emailed to ${emp.official_email}.` }) }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t resend invite', body: e instanceof ApiError ? e.message : undefined }) }
  }

  return (
    <Drawer open onClose={onClose} title={emp.display_name} subtitle={`${emp.designation} · ${emp.employee_code ?? 'no code yet'}`}
      footer={<button className="btn-outline" onClick={resend}><Send size={15} /> Resend invite</button>}>
      <div className="flex items-center gap-4 mb-6">
        <Avatar name={emp.display_name} hue={hueOf(emp.official_email)} size={64} />
        <div className="space-y-1.5">
          <Pill tone={STATUS[emp.status].tone} dot>{STATUS[emp.status].label}</Pill>
          <div className="text-[13px] text-ink-500 flex items-center gap-1.5"><Mail size={14} />{emp.official_email}</div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        {[
          ['Department', emp.department.name], ['Reporting manager', emp.reporting_manager?.display_name ?? '—'],
          ['Joined on', fmtDate(emp.start_date)], ['Employment', emp.employment_type.replace('_', ' ').toLowerCase()],
          ['Probation ends', fmtDate(emp.probation_end)], ['Phone', emp.phone || '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-ink-50/70 p-3"><dt className="text-ink-400 text-[12px]">{k}</dt><dd className="font-semibold text-ink-800 mt-0.5 first-letter:uppercase">{v}</dd></div>
        ))}
      </dl>

      <div className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[14px]">Roles & access</h3>
          {!isAdmin && <span className="text-[12px] text-ink-400 flex items-center gap-1"><ShieldCheck size={13} /> Only Super Admin can change</span>}
        </div>
        <div className="space-y-2">
          {(Object.keys(ROLE_NAMES) as ServerRole[]).map((r) => {
            const locked = !isAdmin || r === 'EMPLOYEE' || (r === 'SUPER_ADMIN' && emp.id === me?.employee?.id)
            const on = roles.includes(r)
            return (
              <label key={r} className={clsx('flex items-center justify-between rounded-xl px-3.5 h-11 ring-1 transition', on ? 'ring-brand-200 bg-brand-50/50' : 'ring-ink-100', locked ? 'opacity-70' : 'cursor-pointer hover:ring-brand-300')}>
                <span className="text-[13.5px] font-medium">{ROLE_NAMES[r]}</span>
                <input type="checkbox" className="size-4 accent-brand-600" checked={on} disabled={locked}
                  onChange={() => setRoles((x) => (on ? x.filter((y) => y !== r) : [...x, r]))} />
              </label>
            )
          })}
        </div>
        {isAdmin && dirty && <button className="btn-primary w-full mt-4" disabled={busy} onClick={saveRoles}>Save roles</button>}
      </div>
    </Drawer>
  )
}

function AddEmployeeDrawer({ open, isAdmin, depts, onClose, onCreated }: { open: boolean; isAdmin: boolean; depts: Department[]; onClose: () => void; onCreated: () => void }) {
  const { toast } = useStore()
  const empty = { display_name: '', official_email: '', phone: '', department_id: '', designation: '', start_date: '', employment_type: 'FULL_TIME', status: 'PROBATION' }
  const [f, setF] = useState(empty)
  const [extra, setExtra] = useState<ServerRole[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<ApiError | null>(null)
  useEffect(() => { if (open) { setF({ ...empty, department_id: depts[0]?.id ?? '' }); setExtra([]); setErr(null) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  const fe = (k: string) => err?.fieldErrors[k]?.[0]
  const valid = f.display_name.trim() && /\S+@\S+\.\S+/.test(f.official_email) && f.department_id && f.designation.trim() && f.start_date

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const e = await api.createEmployee({ ...f, roles: extra })
      toast({ tone: 'success', title: `${e.display_name} added`, body: `Activation link emailed to ${e.official_email}.` })
      onCreated()
    } catch (e) {
      if (e instanceof ApiError) setErr(e)
    } finally { setBusy(false) }
  }

  const Field = ({ k, label, type = 'text', placeholder }: { k: keyof typeof f; label: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} type={type} className={clsx('input', fe(k) && '!border-rose-300')} value={f[k]} onChange={set(k)} placeholder={placeholder} />
      {fe(k) && <p className="text-[12px] text-rose-600 mt-1">{fe(k)}</p>}
    </div>
  )

  return (
    <Drawer open={open} onClose={onClose} title="Add employee" subtitle="They’ll get an email to set their own password"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!valid || busy} onClick={submit}><Send size={15} /> Create & send invite</button></>}>
      <div className="space-y-4">
        {err && !Object.keys(err.fieldErrors).length && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3.5 py-3 text-[13px] flex gap-2"><AlertCircle size={16} className="shrink-0 mt-px" />{err.message}</div>}
        {Field({ k: 'display_name', label: 'Full name', placeholder: 'e.g. Priya Sharma' })}
        {Field({ k: 'official_email', label: 'Work email', type: 'email', placeholder: 'name@antropai.com' })}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="department_id">Department</label>
            <select id="department_id" className="input" value={f.department_id} onChange={set('department_id')}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </div>
          {Field({ k: 'designation', label: 'Designation', placeholder: 'QA Engineer' })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Field({ k: 'start_date', label: 'Start date', type: 'date' })}
          <div>
            <label className="label" htmlFor="employment_type">Employment</label>
            <select id="employment_type" className="input" value={f.employment_type} onChange={set('employment_type')}>
              <option value="FULL_TIME">Full time</option><option value="INTERN">Intern</option><option value="CONTRACT">Contract</option>
            </select>
          </div>
        </div>
        {Field({ k: 'phone', label: 'Phone (optional)', type: 'tel' })}
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" className="input" value={f.status} onChange={set('status')}>
            <option value="PROBATION">Probation (3 months)</option><option value="ACTIVE_CONFIRMED">Confirmed (existing staff)</option><option value="PREBOARDING">Preboarding (code issued on joining)</option>
          </select>
        </div>
        {isAdmin && (
          <div>
            <div className="label">Extra roles</div>
            <div className="flex flex-wrap gap-2">
              {(['HR_OPERATIONS', 'REPORTING_MANAGER', 'INTERVIEWER', 'SUPER_ADMIN'] as ServerRole[]).map((r) => (
                <button type="button" key={r} onClick={() => setExtra((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))}
                  className={clsx('h-8 px-3 rounded-full text-[12.5px] font-semibold ring-1 transition', extra.includes(r) ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200 text-ink-600 hover:ring-ink-300')}>{ROLE_NAMES[r]}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
