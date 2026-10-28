import clsx from 'clsx'
import { AlertCircle, AlertTriangle, BellRing, CalendarCheck, CalendarPlus, House, X, ChevronDown, ChevronLeft, ChevronRight, Clock, Coffee, FilePen, Info, LogIn, LogOut, MapPin, MapPinOff, Play, ShieldCheck, Timer, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import TimeTracker from '../components/TimeTracker'
import { Card, EmptyState, Modal } from '../components/ui'
import { api, ApiError, type AttEventDTO, type HistoryDay, type ProofStatus, type WfhRequestDTO } from '../lib/api'
import { useToday } from '../lib/attendance'
import { fmtDate, fmtTime, hm } from '../lib/format'
import { useStore } from '../lib/store'

const EV: Record<string, { label: string; icon: typeof LogIn; dot: string }> = {
  CHECK_IN: { label: 'Checked in', icon: LogIn, dot: 'bg-emerald-500' },
  START_TEA: { label: 'Started tea break', icon: Coffee, dot: 'bg-amber-500' },
  END_TEA: { label: 'Back from tea', icon: Play, dot: 'bg-brand-500' },
  START_LUNCH: { label: 'Started lunch', icon: UtensilsCrossed, dot: 'bg-sky-500' },
  END_LUNCH: { label: 'Back from lunch', icon: Play, dot: 'bg-brand-500' },
  CHECK_OUT: { label: 'Checked out', icon: LogOut, dot: 'bg-ink-500' },
  LOCATION_VERIFIED: { label: 'Location re-checked', icon: MapPin, dot: 'bg-emerald-400' },
  VERIFICATION_FAILED: { label: 'Location re-check not confirmed', icon: MapPinOff, dot: 'bg-amber-400' },
  CORRECTION_REQUESTED: { label: 'Correction requested', icon: FilePen, dot: 'bg-ink-300' },
  CORRECTION_APPROVED: { label: 'Correction approved by Super Admin', icon: ShieldCheck, dot: 'bg-brand-600' },
  PRESENCE_CONFIRMED: { label: 'Answered “Are you there?”', icon: BellRing, dot: 'bg-brand-400' },
}
const PROOF: Record<ProofStatus, { label: string; cls: string }> = {
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700' },
  INCONCLUSIVE: { label: 'Not confirmed', cls: 'bg-amber-50 text-amber-700' },
  FAILED: { label: 'Outside radius', cls: 'bg-rose-50 text-rose-700' },
  ADMIN_OVERRIDE: { label: 'Admin verified', cls: 'bg-emerald-50 text-emerald-700' },
  REMOTE: { label: 'Work from home', cls: 'bg-brand-50 text-brand-700' },
}
const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

/** Vertical timeline with a time column; also used on the admin day drawer. */
export function Timeline({ events }: { events: AttEventDTO[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="size-14 rounded-2xl bg-brand-50 text-brand-400 grid place-items-center mx-auto"><Clock size={24} /></div>
        <p className="text-[13.5px] font-medium text-ink-700 mt-3">No punches yet today</p>
        <p className="text-[12.5px] text-ink-400 mt-1">Check-in, breaks and check-out appear here with their times.</p>
      </div>
    )
  }
  return (
    <ol>
      {events.map((e, i) => {
        const m = EV[e.type] ?? { label: e.type, icon: FilePen, dot: 'bg-ink-300' }
        return (
          <li key={i} className="grid grid-cols-[66px_16px_1fr] gap-2 pb-5 last:pb-0">
            <span className="text-[12.5px] text-ink-500 tabular-nums whitespace-nowrap pt-0.5">{fmtTime(new Date(e.at))}</span>
            <span className="relative flex justify-center pt-1.5">
              <span className={clsx('size-2.5 rounded-full ring-4 ring-white z-10', m.dot)} />
              {i < events.length - 1 && <span className="absolute top-4 -bottom-5 w-px bg-ink-200" />}
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink-800">{m.label}{e.by_admin && <span className="text-ink-400 font-normal"> · by Super Admin</span>}</div>
              {e.note && <div className="text-[12px] text-ink-400 break-words">{e.note}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

type Row = { date: string; day?: HistoryDay; off: boolean }
const statusOf = (r: Row, today: string) =>
  !r.day ? (r.off ? 'off' : 'none')
    : r.day.status === 'OPEN' ? (r.date < today ? 'missing' : 'live')
      : r.day.shortfall_reason ? 'early' : 'done'
const STATUS = {
  done: { label: 'Complete', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  early: { label: 'Early check-out', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  missing: { label: 'Missing check-out', cls: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  live: { label: 'In progress', cls: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  none: { label: 'No record', cls: 'bg-ink-50 text-ink-500', dot: 'bg-ink-300' },
  off: { label: 'Weekly off', cls: 'bg-ink-50 text-ink-400', dot: 'bg-ink-200' },
} as const
type Filter = 'all' | 'issues'

export default function Attendance() {
  const att = useToday()
  const { toast } = useStore()
  const [month, setMonth] = useState(istToday().slice(0, 7))
  const [hist, setHist] = useState<{ days: HistoryDay[]; workdays: string[] } | null>(null)
  const [histErr, setHistErr] = useState<ApiError | null>(null)
  const [fix, setFix] = useState<HistoryDay | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(() => {
    setHist(null); setHistErr(null)
    api.history(month).then(setHist).catch(setHistErr)
  }, [month])
  useEffect(load, [load])
  // Refresh history whenever today's state changes (check-in, breaks, check-out).
  const todayState = att.data?.state
  useEffect(() => { if (todayState) load() }, [todayState, load])

  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const today = istToday()

  // Every calendar day of the month up to today, newest first, so weekly offs and missing days are visible.
  const rows: Row[] = []
  if (hist) {
    const byDate = new Map(hist.days.map((d) => [d.work_date, d]))
    const [y, m] = month.split('-').map(Number)
    for (let d = new Date(Date.UTC(y, m, 0)).getUTCDate(); d >= 1; d--) {
      const iso = `${month}-${String(d).padStart(2, '0')}`
      if (iso > today) continue
      rows.push({ date: iso, day: byDate.get(iso), off: !hist.workdays.includes(WEEK[new Date(iso + 'T00:00:00Z').getUTCDay()]) })
    }
  }
  // Before the person's first punch this month there is nothing to show: hide those empty days instead of listing them as gaps.
  const first = hist?.days.reduce((m, d) => (d.work_date < m ? d.work_date : m), today) ?? today
  const visible = rows.filter((r) => r.date >= first).filter((r) => filter === 'all' || ['missing', 'early'].includes(statusOf(r, today)))
  const days = hist?.days ?? []
  const closed = days.filter((d) => d.status === 'CLOSED')
  const work = closed.reduce((s, d) => s + d.work_seconds, 0)
  const issues = rows.filter((r) => ['missing', 'early'].includes(statusOf(r, today))).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="text-[13.5px] text-ink-500 font-medium">Self service</div>
          <h1 className="text-[32px] sm:text-[40px] font-extrabold tracking-tight leading-tight mt-1">Attendance</h1>
          <p className="text-ink-500 mt-1">Check in from the office · Monday to Friday · 8h work and 9h in office</p>
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '60ms' }}><TimeTracker att={att} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <Stat icon={CalendarCheck} tone="bg-emerald-50 text-emerald-600" value={hist ? String(days.length) : '—'} label="Days present" sub={fmtDate(month + '-01', { month: 'long' })} />
        <Stat icon={Timer} tone="bg-brand-50 text-brand-600" value={hist ? hm(work) : '—'} label="Net work" sub="Completed days" />
        <Stat icon={Clock} tone="bg-sky-50 text-sky-600" value={hist && closed.length ? hm(Math.round(work / closed.length)) : '—'} label="Average per day" sub="Target 8h" />
        <Stat icon={AlertTriangle} tone={issues ? 'bg-amber-50 text-amber-600' : 'bg-ink-50 text-ink-400'} value={hist ? String(issues) : '—'} label="Need attention" sub="Early or missing check-out" />
      </div>

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-6 min-w-0">
        <Card className="p-5 animate-fade-up" style={{ animationDelay: '140ms' }}>
          <CardTitle icon={Clock} title="Today’s timeline" sub="Recorded by the server · can’t be edited" />
          {att.data ? <Timeline events={att.data.events} /> : <div className="h-28 rounded-2xl bg-ink-50 animate-pulse" />}
        </Card>
        <WfhCard onChange={att.refresh} />
        </div>

        <Card className="animate-fade-up overflow-hidden" style={{ animationDelay: '180ms' }}>
          <div className="flex flex-wrap items-center gap-3 p-5 pb-4">
            <CardTitle icon={CalendarCheck} title="History" sub="Every working day this month" className="mb-0 flex-1" />
            <div className="flex rounded-xl bg-ink-50 p-1 text-[13px] font-medium" role="tablist" aria-label="Filter days">
              {([['all', 'All days'], ['issues', `Needs attention${issues ? ` · ${issues}` : ''}`]] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
                  className={clsx('px-3 h-8 rounded-lg transition', filter === k ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-800')}>{l}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-xl ring-1 ring-ink-100 bg-white p-1">
              <button className="size-8 rounded-lg grid place-items-center text-ink-500 hover:bg-ink-50" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <span className="px-2 text-[13px] font-semibold text-ink-800 min-w-[104px] text-center">{fmtDate(month + '-01', { month: 'short', year: 'numeric' })}</span>
              <button className="size-8 rounded-lg grid place-items-center text-ink-500 hover:bg-ink-50 disabled:opacity-30" onClick={() => shift(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month"><ChevronRight size={16} /></button>
            </div>
          </div>

          {histErr ? <EmptyState icon={AlertCircle} title="Couldn’t load history" body={histErr.message} action={<button className="btn-outline" onClick={load}>Try again</button>} />
            : !hist ? <div className="px-5 pb-5 space-y-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-16 rounded-2xl bg-ink-50 animate-pulse" />)}</div>
            : visible.length === 0 ? (
              <EmptyState icon={filter === 'issues' ? ShieldCheck : LogIn}
                title={filter === 'issues' ? 'Nothing needs attention' : 'No days yet'}
                body={filter === 'issues' ? 'No early or missing check-outs this month.' : 'Your attendance history will appear here once you check in.'} />
            ) : (
              <ul className="px-3 pb-3 space-y-1.5">
                {visible.map((r) => <DayRow key={r.date} row={r} today={today} onFix={setFix} />)}
              </ul>
            )}
        </Card>
      </div>

      <CorrectionModal day={fix} onClose={() => setFix(null)} onDone={() => { setFix(null); load(); att.refresh(); toast({ tone: 'success', title: 'Correction requested', body: 'The Super Admin will review it. Your timeline isn’t changed until it’s approved.' }) }} />
    </div>
  )
}

function DayRow({ row, today, onFix }: { row: Row; today: string; onFix: (d: HistoryDay) => void }) {
  const { date, day } = row
  const st = STATUS[statusOf(row, today)]
  const [open, setOpen] = useState(false)
  const pending = day?.corrections.find((c) => c.status === 'PENDING')
  const decided = day?.corrections.filter((c) => c.status !== 'PENDING').slice(-1)[0]
  const dateBlock = (
    <div className={clsx('size-12 rounded-2xl grid place-items-center shrink-0 leading-none text-center', date === today ? 'bg-gradient-to-br from-[#2338c9] to-[#2f6bff] text-white' : 'bg-ink-50 text-ink-800')}>
      <div>
        <div className="font-display font-extrabold text-[17px]">{Number(date.slice(8))}</div>
        <div className={clsx('text-[10px] font-semibold uppercase mt-0.5', date === today ? 'text-white/75' : 'text-ink-400')}>{fmtDate(date, { weekday: 'short' })}</div>
      </div>
    </div>
  )
  if (!day) {
    return (
      <li className="flex items-center gap-4 rounded-2xl px-2 py-2">
        <div className="opacity-60">{dateBlock}</div>
        <span className="text-[13px] text-ink-400">{st.label}</span>
      </li>
    )
  }
  return (
    <li className={clsx('rounded-2xl ring-1 bg-white transition', open ? 'ring-brand-200 shadow-card' : 'ring-ink-100 hover:ring-brand-200 hover:shadow-card')}>
    <div className="px-2 py-2 grid grid-cols-[auto_1fr] md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
      {dateBlock}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-900 tabular-nums">
          <LogIn size={14} className="text-emerald-500" />{fmtTime(new Date(day.check_in_at))}
          <span className="text-ink-300">→</span>
          <LogOut size={14} className="text-ink-400" />{day.check_out_at ? fmtTime(new Date(day.check_out_at)) : <span className={date < today ? 'text-rose-500' : 'text-ink-400'}>—</span>}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="w-28 h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className={clsx('h-full rounded-full', day.work_seconds >= 28800 ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#12b6ff] to-brand-500')} style={{ width: `${Math.min(100, (day.work_seconds / 28800) * 100)}%` }} /></div>
          <span className="text-[12px] text-ink-500 tabular-nums">{hm(day.work_seconds)} work · {hm(day.tea_seconds + day.lunch_seconds)} breaks</span>
        </div>
      </div>
      <div className="col-span-2 md:col-span-1 flex flex-wrap items-center gap-1.5">
        <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold', st.cls)}><span className={clsx('size-1.5 rounded-full', st.dot)} />{st.label}</span>
        <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium', PROOF[day.proof].cls)}>{day.mode === 'WFH' ? <House size={11} /> : <MapPin size={11} />}{PROOF[day.proof].label}</span>
        {day.presence && day.presence.total > 0 && (
          <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium', day.presence.missed ? 'bg-amber-50 text-amber-700' : 'bg-ink-50 text-ink-600')}>
            <BellRing size={11} />Check-ins {day.presence.answered}/{day.presence.total}
          </span>
        )}
        {day.review_status === 'PENDING_REVIEW' && <span className="inline-flex items-center rounded-lg px-2 py-1 text-[11.5px] font-medium bg-amber-50 text-amber-700">Under review</span>}
        {day.review_status === 'REVIEWED' && <span className="inline-flex items-center rounded-lg px-2 py-1 text-[11.5px] font-medium bg-emerald-50 text-emerald-700">Reviewed</span>}
        {pending && <span className="inline-flex items-center rounded-lg px-2 py-1 text-[11.5px] font-medium bg-brand-50 text-brand-700">Correction pending</span>}
        {!pending && decided && (
          <span className={clsx('inline-flex items-center rounded-lg px-2 py-1 text-[11.5px] font-medium', decided.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
            Correction {decided.status === 'APPROVED' ? 'approved' : 'rejected'}
          </span>
        )}
      </div>
      <div className="col-span-2 md:col-span-1 md:justify-self-end flex items-center gap-1.5">
        {!pending && date < today && (
          <button className="btn h-9 px-3 rounded-xl text-[13px] text-brand-700 ring-1 ring-brand-200 bg-white hover:bg-brand-50" onClick={() => onFix(day)}><FilePen size={15} /> Request correction</button>
        )}
        <button className="size-9 rounded-xl grid place-items-center text-ink-500 hover:bg-ink-50" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Hide punches' : 'Show punches'}>
          <ChevronDown size={18} className={clsx('transition-transform', open && 'rotate-180')} />
        </button>
      </div>
    </div>
    {open && (
      <div className="border-t border-ink-100 px-4 sm:px-6 py-4 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 animate-fade-up">
        <div>
          <div className="eyebrow mb-3">Punches</div>
          <Timeline events={day.events} />
        </div>
        <div className="space-y-3 text-[13px]">
          <div className="eyebrow">Day summary</div>
          <dl className="grid grid-cols-2 gap-2">
            {[['Work', hm(day.work_seconds)], ['In office', hm(day.presence_seconds)], ['Tea', `${hm(day.tea_seconds)} · ${day.tea_count}×`], ['Lunch', hm(day.lunch_seconds)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50 px-3 py-2"><dt className="text-[11.5px] text-ink-500">{k}</dt><dd className="font-semibold text-ink-800 tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {day.plan && <p className="rounded-xl bg-ink-50 px-3 py-2 text-ink-700 whitespace-pre-wrap"><b>Plan:</b> {day.plan}</p>}
          {day.summary && <p className="rounded-xl bg-brand-50 px-3 py-2 text-ink-700 whitespace-pre-wrap"><b>Summary:</b> {day.summary}</p>}
          {day.shortfall_reason && <p className="rounded-xl bg-amber-50 text-amber-800 px-3 py-2"><b>Early check-out reason:</b> {day.shortfall_reason}</p>}
          {day.corrections.map((c) => (
            <p key={c.id} className={clsx('rounded-xl px-3 py-2', c.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800' : c.status === 'REJECTED' ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800')}>
              <b>Correction {c.status.toLowerCase()}:</b> {EV[c.event_type]?.label ?? c.event_type} at {fmtTime(new Date(c.proposed_at))}
              {c.decision_note && <> · “{c.decision_note}”</>}
            </p>
          ))}
        </div>
      </div>
    )}
    </li>
  )
}

function CardTitle({ icon: Icon, title, sub, className }: { icon: typeof Clock; title: string; sub?: string; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-3 mb-5', className)}>
      <span className="size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><Icon size={19} /></span>
      <div className="leading-tight min-w-0">
        <h3 className="font-bold text-[16px] text-ink-900">{title}</h3>
        {sub && <div className="text-[12.5px] text-ink-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, tone, value, label, sub }: { icon: typeof Clock; tone: string; value: string; label: string; sub: string }) {
  return (
    <div className="card p-4 flex items-center gap-3.5 min-w-0">
      <span className={clsx('size-12 rounded-2xl grid place-items-center shrink-0', tone)}><Icon size={21} /></span>
      <div className="min-w-0 leading-tight">
        <div className="font-display font-extrabold text-[22px] text-ink-900 tabular-nums truncate">{value}</div>
        <div className="text-[12.5px] font-medium text-ink-700 truncate mt-0.5">{label}</div>
        <div className="text-[11.5px] text-ink-400 truncate">{sub}</div>
      </div>
    </div>
  )
}

const MISSED = [
  { value: 'CHECK_OUT', label: 'Check-out', icon: LogOut },
  { value: 'END_TEA', label: 'Back from tea', icon: Coffee },
  { value: 'END_LUNCH', label: 'Back from lunch', icon: UtensilsCrossed },
] as const

function CorrectionModal({ day, onClose, onDone }: { day: HistoryDay | null; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('CHECK_OUT')
  const [time, setTime] = useState('18:30')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (day) { setType(day.status === 'OPEN' ? 'CHECK_OUT' : 'END_TEA'); setReason(''); setErr(null) } }, [day])
  if (!day) return null
  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await api.requestCorrection(day.id, { event_type: type, proposed_at: `${day.work_date}T${time}:00+05:30`, reason })
      onDone()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Request a correction · ${fmtDate(day.work_date, { weekday: 'short', day: 'numeric', month: 'short' })}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-brand !rounded-xl" disabled={busy || reason.trim().length < 5} onClick={submit}>Send to Super Admin</button></>}>
      <div className="space-y-5">
        {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3.5 py-3 text-[13px]">{err}</div>}
        <div className="flex items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
          <LogIn size={16} className="text-emerald-500" /> In {fmtTime(new Date(day.check_in_at))}
          <span className="text-ink-300">·</span>
          <LogOut size={16} className="text-ink-400" /> Out {day.check_out_at ? fmtTime(new Date(day.check_out_at)) : 'not recorded'}
        </div>
        <div>
          <div className="label">What was missed?</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {MISSED.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={type === m.value} onClick={() => setType(m.value)}
                className={clsx('flex flex-col items-center gap-2 rounded-2xl py-3.5 px-2 text-[12.5px] font-medium ring-1 transition',
                  type === m.value ? 'bg-brand-50 ring-brand-400 text-brand-700' : 'bg-white ring-ink-200 text-ink-600 hover:ring-ink-300')}>
                <m.icon size={19} />{m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ctime">Actual time (IST)</label>
          <input id="ctime" type="time" className="input !h-12 !rounded-2xl text-[15px]" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="creason">Reason</label>
          <textarea id="creason" className="input h-24 py-2.5 !rounded-2xl resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check out before leaving" />
          <div className="text-[11.5px] text-ink-400 mt-1">At least 5 characters.</div>
        </div>
        <p className="flex gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-[12.5px] text-ink-600"><Info size={16} className="text-brand-600 shrink-0 mt-px" />Your original punches stay as they are. If approved, the corrected punch is added and marked as approved by the Super Admin.</p>
      </div>
    </Modal>
  )
}

const WFH_STATUS: Record<WfhRequestDTO['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700', APPROVED: 'bg-emerald-50 text-emerald-700', REJECTED: 'bg-rose-50 text-rose-700', CANCELLED: 'bg-ink-50 text-ink-400',
}

/** Request work from home in advance; the Super Admin approves. Shows this month's allowance and past decisions. */
function WfhCard({ onChange }: { onChange: () => void }) {
  const { toast } = useStore()
  const [data, setData] = useState<{ requests: WfhRequestDTO[]; used_this_month: number; monthly_limit: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { api.wfhRequests().then(setData).catch(() => setData({ requests: [], used_this_month: 0, monthly_limit: 4 })) }, [])
  useEffect(load, [load])
  const today = istToday()
  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await api.requestWfh({ date, reason })
      toast({ tone: 'success', title: 'Work-from-home request sent', body: 'The Super Admin will approve or reject it.' })
      setOpen(false); setDate(''); setReason(''); load(); onChange()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.') } finally { setBusy(false) }
  }
  const cancel = async (r: WfhRequestDTO) => {
    try { await api.cancelWfh(r.id); toast({ tone: 'success', title: 'Request cancelled' }); load(); onChange() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t cancel', body: e instanceof ApiError ? e.message : undefined }) }
  }
  const left = data ? Math.max(0, data.monthly_limit - data.used_this_month) : null
  return (
    <Card className="p-5 animate-fade-up" style={{ animationDelay: '160ms' }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><House size={19} /></span>
        <div className="flex-1 leading-tight min-w-0">
          <h3 className="font-bold text-[16px] text-ink-900">Work from home</h3>
          <div className="text-[12.5px] text-ink-500 mt-0.5">{data ? `${left} of ${data.monthly_limit} days left this month` : '…'}</div>
        </div>
        {!open && <button className="btn h-9 px-3 rounded-xl text-[13px] text-brand-700 ring-1 ring-brand-200 bg-white hover:bg-brand-50" onClick={() => setOpen(true)} disabled={left === 0}><CalendarPlus size={15} /> Request</button>}
      </div>
      {open && (
        <div className="rounded-2xl ring-1 ring-brand-200 bg-brand-50/40 p-4 space-y-3 mb-4">
          {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-[12.5px]">{err}</div>}
          <div>
            <label className="label" htmlFor="wfh-date">Date</label>
            <input id="wfh-date" type="date" min={today} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="wfh-reason">Reason</label>
            <input id="wfh-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Plumber visiting in the morning" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost btn-sm" onClick={() => { setOpen(false); setErr(null) }}>Cancel</button>
            <button className="btn-brand btn-sm !rounded-xl" disabled={!date || reason.trim().length < 5 || busy} onClick={submit}>Send request</button>
          </div>
          <p className="text-[11.5px] text-ink-500">For a same-day emergency, choose <b>Work from home</b> when you check in and give the reason there.</p>
        </div>
      )}
      {data === null ? <div className="h-16 rounded-2xl bg-ink-50 animate-pulse" />
        : data.requests.length === 0 ? <p className="text-[13px] text-ink-400 text-center py-3">No requests yet. Office days need no request.</p>
        : (
          <ul className="space-y-2">
            {data.requests.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-xl bg-ink-50/70 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-800">
                    {fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    <span className={clsx('rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold', WFH_STATUS[r.status])}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
                    {r.emergency && <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold bg-rose-50 text-rose-700">Emergency</span>}
                  </div>
                  <div className="text-[12px] text-ink-500 truncate">{r.reason}</div>
                  {r.decision_note && <div className="text-[12px] text-ink-400 truncate">“{r.decision_note}”</div>}
                </div>
                {(r.status === 'PENDING' || r.status === 'APPROVED') && !r.used && r.date >= today && (
                  <button className="size-8 rounded-lg grid place-items-center text-ink-400 hover:bg-white hover:text-rose-600 shrink-0" onClick={() => cancel(r)} aria-label="Cancel request" title="Cancel request"><X size={15} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
    </Card>
  )
}
