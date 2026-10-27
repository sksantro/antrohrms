import clsx from 'clsx'
import { AlertCircle, ChevronLeft, ChevronRight, Coffee, FilePen, LogIn, LogOut, MapPin, MapPinOff, Play, ShieldCheck, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import TimeTracker from '../components/TimeTracker'
import { Card, CardHeader, EmptyState, Modal, PageHeader, Pill, type Tone } from '../components/ui'
import { api, ApiError, type AttEventDTO, type HistoryDay, type ProofStatus } from '../lib/api'
import { useToday } from '../lib/attendance'
import { fmtDate, fmtTime, hm } from '../lib/format'
import { useStore } from '../lib/store'

const EV: Record<string, { label: string; icon: typeof LogIn; cls: string }> = {
  CHECK_IN: { label: 'Checked in', icon: LogIn, cls: 'bg-emerald-100 text-emerald-700' },
  START_TEA: { label: 'Started tea break', icon: Coffee, cls: 'bg-amber-100 text-amber-700' },
  END_TEA: { label: 'Resumed work', icon: Play, cls: 'bg-brand-100 text-brand-700' },
  START_LUNCH: { label: 'Started lunch', icon: UtensilsCrossed, cls: 'bg-sky-100 text-sky-700' },
  END_LUNCH: { label: 'Resumed work', icon: Play, cls: 'bg-brand-100 text-brand-700' },
  CHECK_OUT: { label: 'Checked out', icon: LogOut, cls: 'bg-ink-100 text-ink-700' },
  LOCATION_VERIFIED: { label: 'Location re-checked', icon: MapPin, cls: 'bg-emerald-50 text-emerald-600' },
  VERIFICATION_FAILED: { label: 'Location re-check not confirmed', icon: MapPinOff, cls: 'bg-amber-50 text-amber-600' },
  CORRECTION_REQUESTED: { label: 'Correction requested', icon: FilePen, cls: 'bg-ink-50 text-ink-500' },
  CORRECTION_APPROVED: { label: 'Correction approved by Super Admin', icon: ShieldCheck, cls: 'bg-brand-50 text-brand-600' },
}
const PROOF_PILL: Record<ProofStatus, { label: string; tone: Tone }> = {
  VERIFIED: { label: 'Verified', tone: 'green' }, INCONCLUSIVE: { label: 'Not confirmed', tone: 'amber' },
  FAILED: { label: 'Outside radius', tone: 'red' }, ADMIN_OVERRIDE: { label: 'Admin verified', tone: 'green' },
}
const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

export function Timeline({ events }: { events: AttEventDTO[] }) {
  if (events.length === 0) return <p className="text-ink-400 text-[13px] py-6 text-center">No punches yet today.</p>
  return (
    <ol>
      {events.map((e, i) => {
        const m = EV[e.type] ?? { label: e.type, icon: FilePen, cls: 'bg-ink-50 text-ink-500' }
        return (
          <li key={i} className="flex gap-3.5 relative pb-5 last:pb-0">
            {i < events.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-ink-100" />}
            <span className={clsx('size-8 rounded-full grid place-items-center shrink-0', m.cls)}><m.icon size={15} /></span>
            <div className="pt-1 min-w-0">
              <div className="text-[13.5px] font-medium text-ink-800">{m.label}{e.by_admin && <span className="text-ink-400 font-normal"> · by Super Admin</span>}</div>
              <div className="text-[12px] text-ink-400 tabular-nums break-words">{fmtTime(new Date(e.at))}{e.note && <> · {e.note}</>}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function Attendance() {
  const att = useToday()
  const { toast } = useStore()
  const [month, setMonth] = useState(istToday().slice(0, 7))
  const [hist, setHist] = useState<{ days: HistoryDay[]; workdays: string[] } | null>(null)
  const [histErr, setHistErr] = useState<ApiError | null>(null)
  const [fix, setFix] = useState<HistoryDay | null>(null)

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
  const rows: { date: string; day?: HistoryDay; off: boolean }[] = []
  if (hist) {
    const byDate = new Map(hist.days.map((d) => [d.work_date, d]))
    const [y, m] = month.split('-').map(Number)
    for (let d = new Date(Date.UTC(y, m, 0)).getUTCDate(); d >= 1; d--) {
      const iso = `${month}-${String(d).padStart(2, '0')}`
      if (iso > today) continue
      rows.push({ date: iso, day: byDate.get(iso), off: !hist.workdays.includes(WEEK[new Date(iso + 'T00:00:00Z').getUTCDay()]) })
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self service" title="My Attendance" subtitle="Onsite check-in with office geofence · Monday to Friday" />
      <TimeTracker att={att} compact />

      <div className="grid xl:grid-cols-[340px_minmax(0,1fr)] gap-6 mt-6">
        <Card>
          <CardHeader title="Today’s timeline" subtitle="Recorded by the server · can’t be edited" />
          <div className="px-5 pb-5">{att.data ? <Timeline events={att.data.events} /> : <div className="h-24 rounded-xl bg-ink-50 animate-pulse" />}</div>
        </Card>

        <Card>
          <CardHeader title="History" subtitle={fmtDate(month + '-01', { month: 'long', year: 'numeric' })} action={
            <div className="flex items-center gap-1">
              <button className="btn-ghost btn-sm !px-2" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <button className="btn-ghost btn-sm !px-2" onClick={() => shift(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month"><ChevronRight size={16} /></button>
            </div>} />
          {histErr ? <EmptyState icon={AlertCircle} title="Couldn’t load history" body={histErr.message} action={<button className="btn-outline" onClick={load}>Try again</button>} />
            : !hist ? <div className="p-5 space-y-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-10 rounded-xl bg-ink-50 animate-pulse" />)}</div>
            : rows.length === 0 ? <EmptyState icon={LogIn} title="No days yet" body="Your attendance history will appear here." />
            : (
              <div className="px-3 pb-3 overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead><tr><th className="table-th">Date</th><th className="table-th">In</th><th className="table-th">Out</th><th className="table-th">Net work</th><th className="table-th">Breaks</th><th className="table-th">Location</th><th className="table-th">Status</th><th className="table-th" /></tr></thead>
                  <tbody>
                    {rows.map(({ date, day, off }) => {
                      const pending = day?.corrections.find((c) => c.status === 'PENDING')
                      return (
                        <tr key={date} className={clsx(!day && 'bg-ink-50/40')}>
                          <td className="table-td whitespace-nowrap"><span className="font-semibold text-ink-900">{fmtDate(date, { day: '2-digit', month: 'short' })}</span> <span className="text-ink-400 text-[12px]">{fmtDate(date, { weekday: 'short' })}</span></td>
                          {day ? (
                            <>
                              <td className="table-td tabular-nums whitespace-nowrap">{fmtTime(new Date(day.check_in_at))}</td>
                              <td className="table-td tabular-nums whitespace-nowrap">{day.check_out_at ? fmtTime(new Date(day.check_out_at)) : <span className="text-amber-600">—</span>}</td>
                              <td className="table-td">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-16 h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className={clsx('h-full rounded-full', day.work_seconds >= 28800 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.min(100, (day.work_seconds / 28800) * 100)}%` }} /></div>
                                  <span className="tabular-nums whitespace-nowrap">{hm(day.work_seconds)}</span>
                                </div>
                              </td>
                              <td className="table-td tabular-nums whitespace-nowrap">{hm(day.tea_seconds + day.lunch_seconds)}</td>
                              <td className="table-td"><Pill tone={PROOF_PILL[day.proof].tone}>{PROOF_PILL[day.proof].label}</Pill></td>
                              <td className="table-td">
                                {day.status === 'OPEN' && date < today ? <Pill tone="red" dot>Missing check-out</Pill>
                                  : day.status === 'OPEN' ? <Pill tone="blue" dot>In progress</Pill>
                                  : day.shortfall_reason ? <Pill tone="amber" dot>Early check-out</Pill>
                                  : <Pill tone="green" dot>Complete</Pill>}
                                {pending && <div className="text-[11.5px] text-ink-400 mt-1">Correction pending</div>}
                              </td>
                              <td className="table-td text-right">{!pending && date < today && <button className="btn-ghost btn-sm" onClick={() => setFix(day)}>Request correction</button>}</td>
                            </>
                          ) : (
                            <td className="table-td text-ink-400" colSpan={7}>{off ? 'Weekly off' : 'No attendance recorded'}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </Card>
      </div>

      <CorrectionModal day={fix} onClose={() => setFix(null)} onDone={() => { setFix(null); load(); att.refresh(); toast({ tone: 'success', title: 'Correction requested', body: 'The Super Admin will review it. Your timeline isn’t changed until it’s approved.' }) }} />
    </>
  )
}

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
    <Modal open onClose={onClose} title={`Request a correction · ${fmtDate(day.work_date, { day: 'numeric', month: 'short' })}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || reason.trim().length < 5} onClick={submit}>Send to Super Admin</button></>}>
      <div className="space-y-4">
        {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3.5 py-3 text-[13px]">{err}</div>}
        <div>
          <label className="label" htmlFor="ct">What was missed?</label>
          <select id="ct" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="CHECK_OUT">Check-out</option><option value="END_TEA">Resume after tea</option><option value="END_LUNCH">Resume after lunch</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ctime">Actual time (IST)</label>
          <input id="ctime" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="creason">Reason</label>
          <textarea id="creason" className="input h-20 py-2 resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check out before leaving" />
        </div>
        <p className="text-[12px] text-ink-400">Your original punches stay as they are. If approved, the corrected punch is added and marked as approved by the Super Admin.</p>
      </div>
    </Modal>
  )
}
