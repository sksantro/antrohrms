import clsx from 'clsx'
import { AlertCircle, Check, KeyRound, Mail, Phone, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Pill } from '../components/ui'
import { api, ApiError, type EmployeeDTO } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fmtDate } from '../lib/format'
import { useStore } from '../lib/store'

const STATUS: Record<EmployeeDTO['status'], string> = {
  PREBOARDING: 'Preboarding', PROBATION: 'Probation', ACTIVE_CONFIRMED: 'Confirmed', NOTICE_PERIOD: 'Notice period', EXITED: 'Exited', INACTIVE: 'Inactive',
}
const TYPE: Record<EmployeeDTO['employment_type'], string> = { FULL_TIME: 'Full time', INTERN: 'Intern', CONTRACT: 'Contract' }
const hueOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)

export default function Profile() {
  const [emp, setEmp] = useState<EmployeeDTO | null>(null)
  const [err, setErr] = useState<ApiError | null>(null)
  useEffect(() => { api.myProfile().then(setEmp).catch(setErr) }, [])

  return (
    <>
      <PageHeader eyebrow="Self service" title="My Profile" subtitle="Your work details, contact information and password" />
      {err ? <Card><EmptyState icon={AlertCircle} title="Couldn’t load your profile" body={err.message} /></Card>
        : !emp ? <div className="grid lg:grid-cols-2 gap-6">{[0, 1].map((i) => <Card key={i} className="h-72 animate-pulse" />)}</div>
        : (
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <WorkDetails emp={emp} />
            <div className="space-y-6">
              <ContactForm emp={emp} onSaved={setEmp} />
              <PasswordForm />
            </div>
          </div>
        )}
    </>
  )
}

function WorkDetails({ emp }: { emp: EmployeeDTO }) {
  const rows: [string, string][] = [
    ['Employee code', emp.employee_code ?? 'Issued on joining'],
    ['Department', emp.department.name],
    ['Designation', emp.designation],
    ['Reporting manager', emp.reporting_manager?.display_name ?? 'Not set yet'],
    ['Employment', TYPE[emp.employment_type]],
    ['Joined on', fmtDate(emp.start_date)],
    ['Probation', emp.status === 'PROBATION' ? `Ends ${fmtDate(emp.probation_end)}` : emp.status === 'PREBOARDING' ? `Starts after joining` : 'Completed'],
  ]
  return (
    <Card>
      <div className="p-6 flex items-center gap-4 border-b border-ink-100">
        <Avatar name={emp.display_name} hue={hueOf(emp.official_email)} size={60} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{emp.display_name}</h2>
          <div className="text-[13px] text-ink-500 flex items-center gap-1.5 truncate"><Mail size={14} />{emp.official_email}</div>
          <Pill tone={emp.status === 'PROBATION' ? 'amber' : 'green'} dot className="mt-2">{STATUS[emp.status]}</Pill>
        </div>
      </div>
      <dl className="p-6 grid sm:grid-cols-2 gap-3 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-ink-50/70 p-3"><dt className="text-ink-400 text-[12px]">{k}</dt><dd className="font-semibold text-ink-800 mt-0.5">{v}</dd></div>
        ))}
      </dl>
      <p className="px-6 pb-6 text-[12px] text-ink-400 flex gap-2"><ShieldCheck size={14} className="shrink-0 mt-px" />Work details are maintained by HR. If something is wrong, ask HR to update it.</p>
    </Card>
  )
}

function ContactForm({ emp, onSaved }: { emp: EmployeeDTO; onSaved: (e: EmployeeDTO) => void }) {
  const { toast } = useStore()
  const initial = { phone: emp.phone, address: emp.address ?? '', ec_name: emp.emergency_contact?.name ?? '', ec_relationship: emp.emergency_contact?.relationship ?? '', ec_phone: emp.emergency_contact?.phone ?? '' }
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<ApiError | null>(null)
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  const phoneOk = (v: string) => !v || /^[+\d][\d\s-]{6,19}$/.test(v.trim())
  const valid = phoneOk(f.phone) && phoneOk(f.ec_phone)

  const save = async () => {
    setBusy(true); setErr(null)
    try {
      const e = await api.updateEmployee(emp.id, {
        phone: f.phone.trim(), address: f.address.trim(),
        emergency_contact: { name: f.ec_name.trim(), relationship: f.ec_relationship.trim(), phone: f.ec_phone.trim() },
      })
      onSaved(e)
      toast({ tone: 'success', title: 'Contact details saved' })
    } catch (e) { if (e instanceof ApiError) setErr(e) } finally { setBusy(false) }
  }
  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`p-${k}`}>{label}</label>
      <input id={`p-${k}`} className={clsx('input', k.includes('phone') && !phoneOk(f[k]) && '!border-rose-300')} value={f[k]} onChange={set(k)} {...props} />
    </div>
  )
  return (
    <Card>
      <CardHeader icon={Phone} title="Contact & emergency" subtitle="You can update these yourself"
        action={<button className="btn-primary btn-sm" disabled={!dirty || !valid || busy} onClick={save}><Save size={15} /> Save</button>} />
      <div className="p-5 pt-2 space-y-4">
        {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3.5 py-3 text-[13px]">{err.message}</div>}
        {field('phone', 'Mobile number', { type: 'tel', inputMode: 'tel', placeholder: 'e.g. 98xxxxxxxx' })}
        <div>
          <label className="label" htmlFor="p-address">Address</label>
          <textarea id="p-address" className="input h-20 py-2 resize-none" value={f.address} onChange={set('address')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {field('ec_name', 'Emergency contact name')}
          {field('ec_relationship', 'Relationship', { placeholder: 'e.g. Father' })}
        </div>
        {field('ec_phone', 'Emergency contact number', { type: 'tel', inputMode: 'tel' })}
      </div>
    </Card>
  )
}

function PasswordForm() {
  const { toast } = useStore()
  const { me } = useAuth()
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<ApiError | null>(null)
  const rules = [
    { ok: pw.length >= 10, label: 'At least 10 characters' },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), label: 'Letters and numbers' },
    { ok: !!pw && pw === pw2, label: 'Both new passwords match' },
  ]
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await api.changePassword(cur, pw)
      setCur(''); setPw(''); setPw2('')
      toast({ tone: 'success', title: 'Password changed', body: 'You’ve been signed out on your other devices.' })
    } catch (e) { if (e instanceof ApiError) setErr(e) } finally { setBusy(false) }
  }
  const fe = (k: string) => err?.fieldErrors[k]?.map((m) => <p key={m} className="text-[12px] text-rose-600 mt-1">{m}</p>)
  return (
    <Card>
      <CardHeader icon={KeyRound} title="Change password" subtitle={me?.email} />
      <form className="p-5 pt-2 space-y-4" onSubmit={submit}>
        {/* Hidden username helps password managers save the right account. */}
        <input type="email" autoComplete="username" value={me?.email ?? ''} readOnly hidden />
        {err && !Object.keys(err.fieldErrors).length && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3.5 py-3 text-[13px] flex gap-2"><AlertCircle size={16} />{err.message}</div>}
        <div><label className="label" htmlFor="cp-cur">Current password</label><input id="cp-cur" type="password" autoComplete="current-password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} />{fe('current_password')}</div>
        <div><label className="label" htmlFor="cp-new">New password</label><input id="cp-new" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} />{fe('new_password')}</div>
        <div><label className="label" htmlFor="cp-new2">Repeat new password</label><input id="cp-new2" type="password" autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <ul className="space-y-1">
          {rules.map((r) => (
            <li key={r.label} className={clsx('flex items-center gap-2 text-[12.5px]', r.ok ? 'text-emerald-600' : 'text-ink-400')}>
              <span className={clsx('size-4 rounded-full grid place-items-center', r.ok ? 'bg-emerald-500 text-white' : 'bg-ink-100')}><Check size={10} strokeWidth={3} /></span>{r.label}
            </li>
          ))}
        </ul>
        <button className="btn-dark w-full" disabled={busy || !cur || !rules.every((r) => r.ok)}>{busy ? 'Changing…' : 'Change password'}</button>
        <p className="text-[12px] text-ink-400">Forgot your current password? Ask HR for a reset link.</p>
      </form>
    </Card>
  )
}
