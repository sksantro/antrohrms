import { ArrowUpRight, CalendarDays, Clock, FileText, Receipt, Rocket, Sun, UserCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TimeTracker from '../components/TimeTracker'
import { Card, CardHeader, Pill } from '../components/ui'
import { api, type EmployeeDTO, type HistoryDay } from '../lib/api'
import { useToday } from '../lib/attendance'
import { useAuth } from '../lib/auth'
import { fmtDate, greeting, hm } from '../lib/format'

const istMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7)

export default function Home() {
  const { me, hasRole } = useAuth()
  const att = useToday()
  const [profile, setProfile] = useState<EmployeeDTO | null>(null)
  const [days, setDays] = useState<HistoryDay[] | null>(null)
  const emp = me?.employee
  useEffect(() => { api.myProfile().then(setProfile).catch(() => setProfile(null)) }, [])
  const state = att.data?.state
  useEffect(() => { api.history(istMonth()).then((h) => setDays(h.days)).catch(() => setDays([])) }, [state])

  const worked = (days ?? []).filter((d) => d.status === 'CLOSED')
  const totalWork = worked.reduce((s, d) => s + d.work_seconds, 0)
  const early = worked.filter((d) => d.shortfall_reason).length
  const open = (days ?? []).filter((d) => d.status === 'OPEN').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="eyebrow mb-1.5">{fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="text-[28px] font-bold">{greeting()}, {me?.display_name.split(' ')[0]} <span className="inline-block">✨</span></h1>
          <p className="text-ink-500 mt-1">Here’s your day at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          {emp?.status === 'PROBATION' && <Pill tone="amber" dot>Probation · ends {fmtDate(emp.probation_end, { day: 'numeric', month: 'short' })}</Pill>}
          {emp?.employee_code && <Pill tone="gray">{emp.employee_code}</Pill>}
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '60ms' }}><TimeTracker att={att} /></div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <CardHeader icon={Clock} title="This month" subtitle={fmtDate(istMonth() + '-01', { month: 'long', year: 'numeric' })}
            action={<Link to="/app/attendance" className="btn-ghost btn-sm">History <ArrowUpRight size={14} /></Link>} />
          {days === null ? <div className="mx-5 mb-5 h-28 rounded-xl bg-ink-50 animate-pulse" /> : (
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <Stat label="Days completed" value={worked.length} />
              <Stat label="Net work" value={hm(totalWork)} />
              <Stat label="Average / day" value={worked.length ? hm(Math.round(totalWork / worked.length)) : '—'} />
              <Stat label="Early check-outs" value={early} warn={early > 0} />
              {open > 1 && <p className="col-span-2 text-[12.5px] text-amber-700">A previous day has no check-out. Request a correction from My Attendance.</p>}
            </div>
          )}
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: '160ms' }}>
          <CardHeader icon={UserCircle} title="My details" subtitle={profile?.designation ?? emp?.designation}
            action={<Link to="/app/profile" className="btn-ghost btn-sm">Profile <ArrowUpRight size={14} /></Link>} />
          <dl className="px-5 pb-5 space-y-2.5 text-[13px]">
            {[
              ['Department', profile?.department.name ?? emp?.department],
              ['Reporting manager', profile ? profile.reporting_manager?.display_name ?? 'Not set yet' : '…'],
              ['Joined', emp?.start_date ? fmtDate(emp.start_date) : '—'],
              ['Work email', me?.email],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-ink-500">{k}</dt><dd className="font-medium text-ink-800 text-right truncate">{v}</dd></div>
            ))}
          </dl>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: '200ms' }}>
          <CardHeader icon={Rocket} title="Coming soon" subtitle="Being rolled out in phases" />
          <ul className="px-5 pb-5 space-y-2.5">
            {[
              { icon: CalendarDays, label: 'Leave requests & balances', phase: 'P2', to: '/app/leave' },
              { icon: Sun, label: 'Holiday calendar & optional holidays', phase: 'P2', to: '/app/holidays' },
              { icon: Receipt, label: 'Payslips', phase: 'P2', to: '/app/payslips' },
              { icon: FileText, label: 'Documents & letters', phase: 'P3', to: '/app/documents' },
            ].map((x) => (
              <li key={x.label} className="flex items-center gap-3 text-[13px]">
                <span className="size-8 rounded-lg bg-ink-50 text-ink-400 grid place-items-center shrink-0"><x.icon size={15} /></span>
                <span className="flex-1 text-ink-700">{x.label}</span>
                {hasRole('SUPER_ADMIN') && x.phase === 'P2' ? <Link to={x.to} className="text-[11.5px] font-semibold text-brand-600">Preview</Link> : <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Soon</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-ink-50/70 p-3">
      <div className="text-[12px] text-ink-500">{label}</div>
      <div className={`font-display font-bold text-xl mt-0.5 tabular-nums ${warn ? 'text-amber-600' : 'text-ink-900'}`}>{value}</div>
    </div>
  )
}
