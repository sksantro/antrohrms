import clsx from 'clsx'
import { ArrowUpRight, Briefcase, CalendarDays, Check, Clock, Coffee, FileText, IdCard, ListChecks, LogIn, LogOut, MapPin, Minus, Play, Receipt, Rocket, Sun, UserCircle, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TimeTracker from '../components/TimeTracker'
import { Avatar, Card, CardHeader } from '../components/ui'
import { api, type AttEventDTO, type EmployeeDTO, type HistoryDay } from '../lib/api'
import { useToday } from '../lib/attendance'
import { useAuth } from '../lib/auth'
import { fmtDate, fmtTime, greeting, hm } from '../lib/format'
import { useStore } from '../lib/store'

const TZ = 'Asia/Kolkata'
const istDate = (d: Date | number = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const hueOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)

const STATUS_CHIP = {
  NOT_CHECKED_IN: { label: 'Not checked in', cls: 'bg-white text-ink-600 ring-ink-200', dot: 'bg-ink-300' },
  WORKING: { label: 'Checked in', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  ON_TEA: { label: 'On tea break', cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  ON_LUNCH: { label: 'On lunch', cls: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-[#12b6ff]' },
  CHECKED_OUT: { label: 'Checked out', cls: 'bg-white text-ink-600 ring-ink-200', dot: 'bg-ink-400' },
} as const

const EVENT: Record<string, { label: string; icon: typeof LogIn; cls: string }> = {
  CHECK_IN: { label: 'Checked in', icon: LogIn, cls: 'bg-emerald-50 text-emerald-600' },
  START_TEA: { label: 'Started tea break', icon: Coffee, cls: 'bg-amber-50 text-amber-600' },
  END_TEA: { label: 'Back from tea', icon: Play, cls: 'bg-brand-50 text-brand-600' },
  START_LUNCH: { label: 'Went for lunch', icon: UtensilsCrossed, cls: 'bg-sky-50 text-sky-600' },
  END_LUNCH: { label: 'Back from lunch', icon: Play, cls: 'bg-brand-50 text-brand-600' },
  CHECK_OUT: { label: 'Checked out', icon: LogOut, cls: 'bg-ink-100 text-ink-600' },
  LOCATION_VERIFIED: { label: 'Location re-checked', icon: MapPin, cls: 'bg-emerald-50 text-emerald-600' },
  VERIFICATION_FAILED: { label: 'Location not confirmed', icon: MapPin, cls: 'bg-amber-50 text-amber-600' },
}

export default function Home() {
  const { me } = useAuth()
  const { now } = useStore()
  const att = useToday()
  const [profile, setProfile] = useState<EmployeeDTO | null>(null)
  const [days, setDays] = useState<HistoryDay[] | null>(null)
  const emp = me?.employee
  const today = istDate(now)
  const monday = addDays(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7))
  const months = useMemo(() => [...new Set([monday.slice(0, 7), today.slice(0, 7)])], [monday, today])

  useEffect(() => { api.myProfile().then(setProfile).catch(() => setProfile(null)) }, [])
  const state = att.data?.state
  useEffect(() => {
    Promise.all(months.map((m) => api.history(m).then((h) => h.days)))
      .then((all) => setDays(all.flat()))
      .catch(() => setDays([]))
  }, [state, months])

  const month = (days ?? []).filter((d) => d.work_date.startsWith(today.slice(0, 7)))
  const worked = month.filter((d) => d.status === 'CLOSED')
  const totalWork = worked.reduce((s, d) => s + d.work_seconds, 0)
  const early = worked.filter((d) => d.shortfall_reason).length
  const missing = month.filter((d) => d.status === 'OPEN' && d.work_date < today).length
  const firstName = me?.display_name.split(' ')[0] ?? ''
  const chip = STATUS_CHIP[state ?? 'NOT_CHECKED_IN']

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-3xl border border-ink-100 bg-gradient-to-r from-white via-white to-brand-50 shadow-card animate-fade-up">
        <Hills />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <div className="relative">
            <div className="rounded-full p-1 bg-gradient-to-br from-[#12b6ff] via-brand-500 to-fuchsia-500">
              <div className="rounded-full p-1 bg-white"><Avatar name={me?.display_name ?? ''} hue={hueOf(me?.email ?? '')} size={84} /></div>
            </div>
            <span className={clsx('absolute bottom-2 right-2 size-4 rounded-full ring-4 ring-white', chip.dot)} />
          </div>
          <div className="min-w-0 flex-1 basis-full sm:basis-0">
            <div className="eyebrow">{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <h1 className="text-[28px] sm:text-[34px] font-extrabold leading-tight mt-1">{greeting(new Date(now))}, {firstName}</h1>
            <p className="text-ink-500 mt-1">Small steps, consistent effort, big results. Have a productive day!</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className={clsx('inline-flex items-center gap-2 rounded-full px-3 h-8 text-[12.5px] font-semibold ring-1', chip.cls)}>
                <span className={clsx('size-2 rounded-full', chip.dot, state === 'WORKING' && 'animate-pulse2')} />{chip.label}
                {att.data?.day && state !== 'NOT_CHECKED_IN' && <span className="font-normal opacity-75">· since {fmtTime(new Date(att.data.day.check_in_at))}</span>}
              </span>
              {emp?.employee_code && <span className="inline-flex items-center gap-1.5 rounded-full bg-white ring-1 ring-ink-200 px-3 h-8 text-[12.5px] font-medium text-ink-700"><IdCard size={14} className="text-ink-400" />{emp.employee_code}</span>}
              {(profile?.designation ?? emp?.designation) && <span className="inline-flex items-center gap-1.5 rounded-full bg-white ring-1 ring-ink-200 px-3 h-8 text-[12.5px] font-medium text-ink-700"><Briefcase size={14} className="text-ink-400" />{profile?.designation ?? emp?.designation}</span>}
              {emp?.status === 'PROBATION' && <span className="inline-flex items-center rounded-full bg-amber-50 ring-1 ring-amber-200 px-3 h-8 text-[12.5px] font-medium text-amber-800">Probation · ends {fmtDate(emp.probation_end, { day: 'numeric', month: 'short' })}</span>}
            </div>
          </div>
          <div className="hidden xl:block rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white px-6 py-5 text-right shadow-card">
            <div className="font-display font-extrabold text-[34px] leading-none tabular-nums text-ink-900">
              {new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(now)}
            </div>
            <div className="text-[12.5px] text-ink-500 mt-2">India Standard Time</div>
            <div className="text-[12.5px] font-semibold text-brand-gradient mt-3">Great people build extraordinary things.</div>
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 animate-fade-up" style={{ animationDelay: '60ms' }}><TimeTracker att={att} /></div>
        <ThisWeek days={days} today={today} monday={monday} joined={emp?.start_date} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="animate-fade-up" style={{ animationDelay: '140ms' }}>
          <CardHeader icon={CalendarDays} title="This month" subtitle={fmtDate(today.slice(0, 7) + '-01', { month: 'long', year: 'numeric' })}
            action={<Link to="/app/attendance" className="btn-ghost btn-sm">History <ArrowUpRight size={14} /></Link>} />
          {days === null ? <div className="mx-5 mb-5 h-36 rounded-2xl bg-ink-50 animate-pulse" /> : (
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <Stat label="Days completed" value={worked.length} tone="text-emerald-600" />
              <Stat label="Net work" value={hm(totalWork)} />
              <Stat label="Average / day" value={worked.length ? hm(Math.round(totalWork / worked.length)) : '—'} />
              <Stat label="Early check-outs" value={early} tone={early ? 'text-amber-600' : undefined} />
              {missing > 0 && <p className="col-span-2 rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-[12.5px]">{missing} day{missing > 1 ? 's have' : ' has'} no check-out. Request a correction from My Attendance.</p>}
            </div>
          )}
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: '180ms' }}>
          <CardHeader icon={ListChecks} title="Today’s activity" subtitle="Recorded by the server"
            action={<Link to="/app/attendance" className="btn-ghost btn-sm">Timeline <ArrowUpRight size={14} /></Link>} />
          <Activity events={att.data?.events} />
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: '220ms' }}>
          <CardHeader icon={UserCircle} title="My details" subtitle={profile?.designation ?? emp?.designation}
            action={<Link to="/app/profile" className="btn-ghost btn-sm">Profile <ArrowUpRight size={14} /></Link>} />
          <dl className="px-5 pb-5 space-y-3 text-[13px]">
            {[
              ['Department', profile?.department.name ?? emp?.department],
              ['Reporting manager', profile ? profile.reporting_manager?.display_name ?? 'Not set yet' : '…'],
              ['Joined', emp?.start_date ? fmtDate(emp.start_date) : '—'],
              ['Work email', me?.email],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                <dt className="text-ink-500 shrink-0">{k}</dt><dd className="font-medium text-ink-800 text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <section className="rounded-3xl border border-dashed border-ink-200 p-5 flex flex-wrap items-center gap-x-6 gap-y-3 animate-fade-up" style={{ animationDelay: '260ms' }}>
        <span className="flex items-center gap-2.5 font-semibold text-ink-800"><span className="size-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Rocket size={17} /></span>Coming soon</span>
        {[
          { icon: CalendarDays, label: 'Leave & balances' },
          { icon: Sun, label: 'Holiday calendar' },
          { icon: Receipt, label: 'Payslips' },
          { icon: FileText, label: 'Documents & letters' },
        ].map((x) => <span key={x.label} className="inline-flex items-center gap-2 text-[13px] text-ink-500"><x.icon size={15} className="text-ink-400" />{x.label}</span>)}
      </section>
    </div>
  )
}

/** Soft layered hills on the right of the banner, in brand tints. */
function Hills() {
  return (
    <svg className="absolute inset-y-0 right-0 h-full w-[70%] pointer-events-none" viewBox="0 0 800 260" preserveAspectRatio="xMaxYMax slice" aria-hidden>
      <defs>
        <linearGradient id="h1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c7d2fe" /><stop offset="1" stopColor="#eef2ff" /></linearGradient>
        <linearGradient id="h2" x1="0" x2="1"><stop offset="0" stopColor="#bae6fd" /><stop offset="1" stopColor="#ddd6fe" /></linearGradient>
        <linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stopColor="#fff" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <radialGradient id="sun"><stop offset="0" stopColor="#fde68a" stopOpacity=".9" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="640" cy="70" r="90" fill="url(#sun)" />
      <path d="M180 260 L360 120 L430 170 L540 70 L640 150 L720 110 L800 150 V260 Z" fill="url(#h1)" opacity=".9" />
      <path d="M260 260 C380 190 460 200 560 160 C640 128 720 170 800 140 V260 Z" fill="url(#h2)" opacity=".75" />
      <path d="M340 260 C460 225 560 230 660 205 C720 190 760 200 800 192 V260 Z" fill="#e0e7ff" />
      <rect width="800" height="260" fill="url(#fadeL)" />
    </svg>
  )
}

function ThisWeek({ days, today, monday, joined }: { days: HistoryDay[] | null; today: string; monday: string; joined?: string }) {
  const byDate = new Map((days ?? []).map((d) => [d.work_date, d]))
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const kind = (date: string, i: number) => {
    const d = byDate.get(date)
    if (date > today) return 'upcoming'
    if (d?.status === 'OPEN') return date === today ? 'live' : 'missing'
    if (d) return d.shortfall_reason ? 'early' : 'done'
    if (i >= 5) return 'off'
    if (date === today) return 'today'
    return joined && date < joined ? 'off' : 'none'
  }
  const STYLE = {
    done: { icon: <Check size={15} strokeWidth={3} />, cls: 'bg-emerald-500 text-white', label: 'Complete' },
    early: { icon: <Check size={15} strokeWidth={3} />, cls: 'bg-amber-500 text-white', label: 'Early check-out' },
    live: { icon: <Clock size={15} />, cls: 'bg-gradient-to-br from-[#12b6ff] to-brand-600 text-white', label: 'In progress' },
    missing: { icon: <X size={15} strokeWidth={3} />, cls: 'bg-rose-500 text-white', label: 'Missing check-out' },
    today: { icon: <Clock size={15} />, cls: 'bg-brand-50 text-brand-600 ring-1 ring-brand-200', label: 'Today' },
    none: { icon: <Minus size={15} />, cls: 'bg-ink-100 text-ink-400', label: 'No record' },
    off: { icon: <Minus size={15} />, cls: 'bg-ink-50 text-ink-300', label: 'Off' },
    upcoming: { icon: null, cls: 'bg-white border border-dashed border-ink-200', label: 'Upcoming' },
  } as const
  return (
    <Card className="animate-fade-up flex flex-col" style={{ animationDelay: '100ms' }}>
      <CardHeader icon={CalendarDays} title="This week" subtitle={`${fmtDate(monday, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(monday, 6), { day: 'numeric', month: 'short' })}`} />
      {days === null ? <div className="mx-5 mb-5 h-40 rounded-2xl bg-ink-50 animate-pulse" /> : (
        <div className="px-5 pb-5 flex-1 flex flex-col">
          <ol className="grid grid-cols-7 gap-1.5">
            {week.map((date, i) => {
              const k = kind(date, i)
              const s = STYLE[k]
              const d = byDate.get(date)
              return (
                <li key={date} title={`${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })} · ${s.label}${d && d.status === 'CLOSED' ? ` · ${hm(d.work_seconds)}` : ''}`}
                  className={clsx('flex flex-col items-center gap-2 rounded-2xl py-3', date === today && 'bg-brand-50/70 ring-1 ring-brand-100')}>
                  <span className={clsx('text-[11px] font-semibold uppercase', date === today ? 'text-brand-600' : 'text-ink-400')}>{fmtDate(date, { weekday: 'short' }).slice(0, 3)}</span>
                  <span className={clsx('text-[15px] font-bold tabular-nums', date === today ? 'text-brand-700' : 'text-ink-800')}>{Number(date.slice(8))}</span>
                  <span className={clsx('size-7 rounded-full grid place-items-center', s.cls)}>{s.icon}</span>
                </li>
              )
            })}
          </ol>
          <ul className="mt-auto pt-5 flex flex-wrap gap-x-4 gap-y-2 text-[11.5px] text-ink-500">
            {(['done', 'early', 'missing', 'off'] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5"><span className={clsx('size-2.5 rounded-full', STYLE[k].cls.split(' ')[0])} />{STYLE[k].label}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Activity({ events }: { events?: AttEventDTO[] }) {
  if (!events) return <div className="mx-5 mb-5 h-36 rounded-2xl bg-ink-50 animate-pulse" />
  const shown = events.filter((e) => EVENT[e.type]).slice(-5).reverse()
  if (shown.length === 0) {
    return (
      <div className="px-5 pb-6 pt-2 text-center">
        <div className="size-12 rounded-2xl bg-ink-50 text-ink-300 grid place-items-center mx-auto"><Clock size={22} /></div>
        <p className="text-[13px] text-ink-500 mt-3">Nothing yet today. Your check-in, breaks and check-out will show up here.</p>
      </div>
    )
  }
  return (
    <ol className="px-5 pb-5 relative">
      {shown.map((e, i) => {
        const m = EVENT[e.type]
        return (
          <li key={e.at + e.type} className="flex gap-3 relative pb-4 last:pb-0">
            {i < shown.length - 1 && <span className="absolute left-[17px] top-9 bottom-0 w-px bg-ink-100" />}
            <span className={clsx('size-9 rounded-xl grid place-items-center shrink-0', m.cls)}><m.icon size={16} /></span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-[13.5px] font-medium text-ink-800">{m.label}{e.by_admin && <span className="text-ink-400 font-normal"> · by Super Admin</span>}</div>
              <div className="text-[12px] text-ink-400">{fmtTime(new Date(e.at))}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl bg-ink-50/80 p-3.5">
      <div className="text-[12px] text-ink-500">{label}</div>
      <div className={clsx('font-display font-extrabold text-[22px] mt-0.5 tabular-nums', tone ?? 'text-ink-900')}>{value}</div>
    </div>
  )
}
