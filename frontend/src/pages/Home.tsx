import clsx from 'clsx'
import { ArrowRight, CalendarDays, CalendarPlus, ChevronRight, Clock, Coffee, FilePen, History, KeyRound, LogIn, LogOut, MapPin, Play, Quote, Receipt, UserCircle, UserPen, UtensilsCrossed, Zap } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import TimeTracker from '../components/TimeTracker'
import { Card, ProgressRing } from '../components/ui'
import { api, type AttEventDTO, type EmployeeDTO, type HistoryDay } from '../lib/api'
import { useToday } from '../lib/attendance'
import { useAuth } from '../lib/auth'
import { fmtDate, fmtTime, greeting, hm } from '../lib/format'
import { useStore } from '../lib/store'

const TZ = 'Asia/Kolkata'
const istDate = (d: Date | number = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const TYPE: Record<string, string> = { FULL_TIME: 'Full time', INTERN: 'Intern', CONTRACT: 'Contract' }

/** Monday–Friday dates from `from` up to and including `to` (ISO strings). */
function weekdaysBetween(from: string, to: string) {
  let n = 0
  for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() % 6 !== 0) n++
  }
  return n
}

const EVENT: Record<string, { label: string; icon: typeof LogIn; dot: string; pill?: [string, string] }> = {
  CHECK_IN: { label: 'Checked in', icon: LogIn, dot: 'bg-emerald-500', pill: ['Started', 'bg-emerald-50 text-emerald-700'] },
  START_TEA: { label: 'Tea break', icon: Coffee, dot: 'bg-amber-500' },
  END_TEA: { label: 'Back from tea', icon: Play, dot: 'bg-brand-500' },
  START_LUNCH: { label: 'Lunch break', icon: UtensilsCrossed, dot: 'bg-sky-500' },
  END_LUNCH: { label: 'Back from lunch', icon: Play, dot: 'bg-brand-500' },
  CHECK_OUT: { label: 'Checked out', icon: LogOut, dot: 'bg-ink-400', pill: ['Done', 'bg-ink-100 text-ink-600'] },
  LOCATION_VERIFIED: { label: 'Location re-checked', icon: MapPin, dot: 'bg-emerald-400' },
  VERIFICATION_FAILED: { label: 'Location not confirmed', icon: MapPin, dot: 'bg-amber-400', pill: ['Review', 'bg-amber-50 text-amber-700'] },
}

export default function Home() {
  const { me } = useAuth()
  const { now } = useStore()
  const att = useToday()
  const [profile, setProfile] = useState<EmployeeDTO | null>(null)
  const [days, setDays] = useState<HistoryDay[] | null>(null)
  const emp = me?.employee
  const today = istDate(now)
  const month = today.slice(0, 7)

  useEffect(() => { api.myProfile().then(setProfile).catch(() => setProfile(null)) }, [])
  const state = att.data?.state
  useEffect(() => { api.history(month).then((h) => setDays(h.days)).catch(() => setDays([])) }, [state, month])

  const present = (days ?? []).filter((d) => d.work_date <= today)
  const closed = present.filter((d) => d.status === 'CLOSED')
  const totalWork = closed.reduce((s, d) => s + d.work_seconds, 0)
  const early = closed.filter((d) => d.shortfall_reason).length
  // Count working days from the later of: month start, joining date, first day this person used the system (so go-live week doesn't look like absences).
  const firstUse = present.reduce((m, d) => (d.work_date < m ? d.work_date : m), today)
  const from = [`${month}-01`, emp?.start_date ?? '', firstUse].sort().pop()!
  const workdays = Math.max(present.length, weekdaysBetween(from, today))
  const workTarget = (att.data?.thresholds.work_seconds ?? 28800) * Math.max(1, closed.length)

  const live = att.live
  const t = att.data?.thresholds
  const earliestOut = live && t && att.data?.day && !att.data.day.stale && state !== 'CHECKED_OUT'
    ? fmtTime(live.serverNow + Math.max(t.work_seconds - live.work, t.presence_seconds - live.presence, 0) * 1000) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="text-[13.5px] text-ink-500 font-medium">{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="text-[32px] sm:text-[40px] font-extrabold leading-tight tracking-tight mt-1">{greeting(new Date(now))}, {me?.display_name.split(' ')[0]} <span className="inline-block origin-[70%_70%] animate-[wave_2.4s_ease-in-out_1]">👋</span></h1>
          <p className="text-ink-500 mt-1 flex flex-wrap items-center gap-2">
            Here’s your workday overview.
            {emp?.status === 'PROBATION' && <span className="rounded-full bg-amber-50 text-amber-800 px-2.5 py-0.5 text-[12px] font-medium">Probation · ends {fmtDate(emp.probation_end, { day: 'numeric', month: 'short' })}</span>}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 ring-1 ring-ink-100 shadow-card px-5 py-4 max-w-[320px]">
          <Quote size={22} className="text-brand-300 shrink-0 rotate-180" fill="currentColor" />
          <p className="text-[13.5px] text-ink-600 leading-snug">Small steps every day lead to big results.</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4 min-w-0 animate-fade-up" style={{ animationDelay: '60ms' }}>
          <TimeTracker att={att} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile icon={LogIn} tone="bg-emerald-50 text-emerald-600" value={att.data?.day ? fmtTime(new Date(att.data.day.check_in_at)) : '—'} label="Checked in" sub={att.data?.day ? fmtDate(att.data.day.work_date, { day: 'numeric', month: 'short' }) : 'Not yet today'} />
            <Tile icon={LogOut} tone="bg-rose-50 text-rose-500" value={state === 'CHECKED_OUT' && att.data?.day?.check_out_at ? fmtTime(new Date(att.data.day.check_out_at)) : earliestOut ?? '—'} label={state === 'CHECKED_OUT' ? 'Checked out' : 'Earliest check-out'} sub={`${(t?.presence_seconds ?? 32400) / 3600}h in office`} />
            <Tile icon={Coffee} tone="bg-amber-50 text-amber-600" value={live ? hm(live.tea) : '—'} label="Tea breaks" sub={`${att.data?.tea_count ?? 0} taken today`} />
            <Tile icon={UtensilsCrossed} tone="bg-sky-50 text-sky-600" value={live ? hm(live.lunch) : '—'} label="Lunch" sub={`Target 30–${(t?.lunch_exceed_seconds ?? 2700) / 60} min`} />
          </div>
        </div>
        <Timeline events={att.data?.events} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 animate-fade-up" style={{ animationDelay: '140ms' }}>
          <Head icon={CalendarDays} title="This month" sub={fmtDate(`${month}-01`, { month: 'long', year: 'numeric' })} to="/app/attendance" link="View history" />
          {days === null ? <div className="h-44 rounded-2xl bg-ink-50 animate-pulse" /> : (
            <div className="grid grid-cols-2 gap-3">
              <MonthStat label="Attendance" value={`${present.length} / ${workdays}`} sub="Days present" ring={present.length / Math.max(1, workdays)} color="#12b6ff" />
              <MonthStat label="Work hours" value={hm(totalWork)} sub="This month" ring={totalWork / workTarget} color="#3d5afe" />
              <MonthStat label="Average / day" value={closed.length ? hm(Math.round(totalWork / closed.length)) : '—'} sub={`Target ${(t?.work_seconds ?? 28800) / 3600}h`} />
              <MonthStat label="Early check-outs" value={String(early)} sub="This month" warn={early > 0} />
            </div>
          )}
        </Card>

        <Card className="p-5 animate-fade-up" style={{ animationDelay: '180ms' }}>
          <Head icon={UserCircle} title="My details" to="/app/profile" link="View profile" />
          <dl className="space-y-3 text-[13px]">
            {[
              ['Name', me?.display_name],
              ['Role', profile?.designation ?? emp?.designation],
              ['Department', profile?.department.name ?? emp?.department],
              ['Manager', profile ? profile.reporting_manager?.display_name ?? 'Not set yet' : '…'],
              ['Work email', me?.email],
              ['Joining date', emp?.start_date ? fmtDate(emp.start_date) : '—'],
              ['Employment type', profile ? TYPE[profile.employment_type] : '…'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-500 shrink-0">{k}</dt><dd className="font-medium text-ink-800 text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5 animate-fade-up" style={{ animationDelay: '220ms' }}>
          <Head icon={Zap} title="Quick actions" />
          <div className="grid grid-cols-3 gap-2.5">
            <QuickAction to="/app/attendance" icon={FilePen} label="Request correction" />
            <QuickAction to="/app/attendance" icon={History} label="Attendance history" />
            <QuickAction to="/app/profile" icon={UserPen} label="Update profile" />
            <QuickAction to="/app/profile" icon={KeyRound} label="Change password" />
            <QuickAction icon={CalendarPlus} label="Apply leave" soon />
            <QuickAction icon={Receipt} label="View payslip" soon />
          </div>
        </Card>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-50 via-white to-sky-50 ring-1 ring-ink-100 px-6 py-5 flex flex-wrap items-center gap-5 animate-fade-up" style={{ animationDelay: '260ms' }}>
        <ProfileArt />
        <div className="flex-1 min-w-[220px]">
          <div className="font-semibold text-ink-900">Keep your information updated</div>
          <p className="text-[13px] text-ink-500 mt-0.5">Check your mobile number, address and emergency contact so HR can reach you.</p>
        </div>
        <Link to="/app/profile" className="btn h-11 px-5 bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">Update profile <ArrowRight size={16} /></Link>
      </section>
    </div>
  )
}

function Head({ icon: Icon, title, sub, to, link }: { icon: typeof Clock; title: string; sub?: string; to?: string; link?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><Icon size={19} /></span>
      <div className="flex-1 min-w-0 leading-tight">
        <h3 className="font-bold text-[16px] text-ink-900">{title}</h3>
        {sub && <div className="text-[12.5px] text-ink-500 mt-0.5">{sub}</div>}
      </div>
      {to && <Link to={to} className="text-[13px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">{link} <ArrowRight size={14} /></Link>}
    </div>
  )
}

function Tile({ icon: Icon, tone, value, label, sub }: { icon: typeof Clock; tone: string; value: string; label: string; sub: string }) {
  return (
    <Link to="/app/attendance" className="card p-4 flex items-center gap-3.5 min-w-0 group hover:shadow-lift hover:-translate-y-0.5 transition">
      <span className={clsx('size-12 rounded-2xl grid place-items-center shrink-0', tone)}><Icon size={21} /></span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="font-display font-extrabold text-[22px] text-ink-900 tabular-nums truncate">{value}</div>
        <div className="text-[12.5px] font-medium text-ink-700 truncate mt-0.5">{label}</div>
        <div className="text-[11.5px] text-ink-400 truncate">{sub}</div>
      </div>
      <ChevronRight size={18} className="text-ink-300 group-hover:text-brand-600 shrink-0 self-start mt-1" />
    </Link>
  )
}

function MonthStat({ label, value, sub, ring, color, warn }: { label: string; value: string; sub: string; ring?: number; color?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-ink-50/80 p-3.5 flex items-center gap-2 min-w-0">
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-ink-500 truncate">{label}</div>
        <div className={clsx('font-display font-extrabold text-[20px] tabular-nums mt-0.5 truncate', warn ? 'text-amber-600' : 'text-ink-900')}>{value}</div>
        <div className="text-[11.5px] text-ink-400 truncate">{sub}</div>
      </div>
      {ring !== undefined && (
        <ProgressRing value={ring} size={54} stroke={6} color={color}>
          <span className="text-[11px] font-bold text-ink-700">{Math.round(Math.min(1, ring) * 100)}%</span>
        </ProgressRing>
      )}
    </div>
  )
}

function QuickAction({ to, icon: Icon, label, soon }: { to?: string; icon: typeof Clock; label: string; soon?: boolean }) {
  const body = (
    <>
      <Icon size={20} className={soon ? 'text-ink-300' : 'text-brand-600'} />
      <span className={clsx('text-[12px] font-medium leading-tight', soon ? 'text-ink-400' : 'text-ink-700')}>{label}</span>
      {soon && <span className="absolute top-1.5 right-1.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400 bg-ink-50 rounded-full px-1.5">Soon</span>}
    </>
  )
  const cls = 'relative flex flex-col items-center justify-center gap-2 text-center rounded-2xl ring-1 ring-ink-100 h-[88px] px-2 transition'
  return soon
    ? <div className={clsx(cls, 'bg-ink-50/40 cursor-default')} title="Coming soon">{body}</div>
    : <Link to={to!} className={clsx(cls, 'bg-white hover:ring-brand-200 hover:shadow-card hover:-translate-y-0.5')}>{body}</Link>
}

function Timeline({ events }: { events?: AttEventDTO[] }) {
  const shown = (events ?? []).filter((e) => EVENT[e.type])
  return (
    <Card className="p-5 flex flex-col animate-fade-up" style={{ animationDelay: '100ms' }}>
      <Head icon={Clock} title="Today’s timeline" sub="Recorded by the server" to="/app/attendance" link="View all" />
      {!events ? <div className="flex-1 min-h-40 rounded-2xl bg-ink-50 animate-pulse" /> : shown.length === 0 ? (
        <div className="flex-1 grid place-items-center text-center py-8">
          <div>
            <div className="size-14 rounded-2xl bg-brand-50 text-brand-400 grid place-items-center mx-auto"><Clock size={24} /></div>
            <p className="text-[13.5px] font-medium text-ink-700 mt-3">Nothing yet today</p>
            <p className="text-[12.5px] text-ink-400 mt-1 max-w-[220px]">Your check-in, breaks and check-out will appear here with their times.</p>
          </div>
        </div>
      ) : (
        <ol className="space-y-0">
          {shown.map((e, i) => {
            const m = EVENT[e.type]
            return (
              <li key={e.at + e.type} className="grid grid-cols-[66px_16px_1fr_auto] items-start gap-2 pb-5 last:pb-0 relative">
                <span className="text-[12.5px] text-ink-500 tabular-nums pt-0.5 whitespace-nowrap">{fmtTime(new Date(e.at))}</span>
                <span className="relative flex justify-center pt-1.5">
                  <span className={clsx('size-2.5 rounded-full ring-4 ring-white z-10', m.dot)} />
                  {i < shown.length - 1 && <span className="absolute top-4 -bottom-5 w-px bg-ink-200" />}
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink-800">{m.label}</div>
                  <div className="text-[12px] text-ink-400 truncate">{e.by_admin ? 'By Super Admin' : e.note || 'Office'}</div>
                </div>
                {m.pill && <span className={clsx('text-[11px] font-semibold rounded-lg px-2 py-0.5', m.pill[1])}>{m.pill[0]}</span>}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

/** A person working on a laptop, in brand colours. */
function ProfileArt(): ReactNode {
  return (
    <svg width="120" height="76" viewBox="0 0 120 76" className="shrink-0 -my-2" aria-hidden>
      <defs><linearGradient id="pa" x1="0" x2="1"><stop offset="0" stopColor="#12b6ff" /><stop offset="1" stopColor="#5b5cff" /></linearGradient></defs>
      <ellipse cx="60" cy="71" rx="48" ry="4" fill="#c7d2fe" opacity=".7" />
      <circle cx="96" cy="16" r="10" fill="#e0e7ff" />
      <path d="M90 16h12M96 10v12" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      {/* hair + head */}
      <path d="M44 22c0-9 7-14 15-13 9 1 13 8 12 16-1 5-3 6-3 6l-2-9c-4 1-10 0-14-4-2 3-4 5-6 5l-1 5s-1-2-1-6z" fill="#1e1b4b" />
      <circle cx="58" cy="24" r="8.5" fill="#fcd9bd" />
      <path d="M50 20c3-4 10-6 16-2" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" />
      {/* body */}
      <path d="M40 70c0-15 7-30 18-30s18 15 18 30z" fill="url(#pa)" />
      {/* laptop */}
      <path d="M30 48h40l-6 20H24z" fill="#1e293b" />
      <path d="M22 68h50v3H22z" fill="#334155" />
      <circle cx="47" cy="58" r="2" fill="#7dd3fc" />
      {/* arm */}
      <path d="M70 52c-6 3-11 6-16 10" stroke="#fcd9bd" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
