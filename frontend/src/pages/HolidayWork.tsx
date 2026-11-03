import clsx from 'clsx'
import { CalendarClock, House, Pause, Play, Siren, Square, Timer, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, Drawer, EmptyState, Modal, PageHeader, Pill, type Tone } from '../components/ui'
import { api, type HolidayWorkDTO, type HolidayWorkStatus } from '../lib/api'
import { fmtDate, hm, istToday } from '../lib/format'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'

export const HW_STATUS: Record<HolidayWorkStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'Waiting for approval', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'green' },
  EMERGENCY: { label: 'Emergency: review after', tone: 'amber' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
  AWAITING_REVIEW: { label: 'Awaiting verification', tone: 'blue' },
  CREDITED: { label: 'Comp-Off credited', tone: 'green' },
  NOT_CREDITED: { label: 'No comp-off', tone: 'gray' },
}

export const day = (d: string) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })

/** Seconds worked so far, counting a running interval up to now. */
export function workedNow(h: Pick<HolidayWorkDTO, 'intervals'>, now = Date.now()) {
  return Math.round(h.intervals.reduce((s, [a, b]) => s + ((b ? Date.parse(b) : now) - Date.parse(a)), 0) / 1000)
}

/** Remote-only work on a weekly off or holiday (BRD §7). Approved hours become Comp-Off after the Super Admin verifies them. */
export default function HolidayWork() {
  const { toast } = useStore()
  const { data, error, reload } = useApi(() => api.holidayWork(), [])
  const [form, setForm] = useState(false)
  const [ending, setEnding] = useState<HolidayWorkDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const reqs = data?.requests ?? []
  const active = reqs.find((r) => r.can_work || (r.running && r.status !== 'AWAITING_REVIEW'))
  const b = data?.balance

  const act = async (h: HolidayWorkDTO, action: 'start' | 'pause' | 'cancel') => {
    setBusy(true)
    try { await api.holidayWorkAction(h.id, action); if (action === 'cancel') toast({ tone: 'success', title: 'Request cancelled' }); reload() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t do that', body: errMsg(e) }) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader eyebrow="Weekends & holidays" title="Holiday Work" subtitle="Work from home on a weekly off or holiday, with approval. Verified hours become Comp-Off."
        actions={<button className="btn-brand h-11 px-5 rounded-xl" onClick={() => setForm(true)} disabled={!data}><CalendarClock size={17} /> Request holiday work</button>} />
      {error && <Card className="p-5 text-rose-700 mb-6">{error}</Card>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start mb-6">
        {active ? <ActiveCard h={active} busy={busy} onAct={act} onEnd={() => setEnding(active)} /> : (
          <Card className="p-6 flex items-center gap-4">
            <span className="size-12 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><House size={22} /></span>
            <div className="text-[13.5px] text-ink-600">Nothing to work on today. Request a weekend or holiday ahead of time; the Super Admin approves it, then you start and stop work here on the day. No office location is needed.</div>
          </Card>
        )}
        <Card className="p-5">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">Comp-Off balance</div>
          <div className="flex items-end gap-2 mt-2"><span className="text-[34px] font-bold text-ink-900 leading-none">{b ? b.available : '–'}</span><span className="text-ink-500 mb-1">day{b?.available === 1 ? '' : 's'} left</span></div>
          {b && <div className="text-[12.5px] text-ink-500 mt-2">{b.granted} earned · {b.used} used{b.pending ? ` · ${b.pending} pending` : ''}{b.expired ? ` · ${b.expired} expired` : ''}</div>}
          {b?.next_expiry && <div className="text-[12px] text-amber-700 mt-1">Use by {fmtDate(b.next_expiry, { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
          <div className="text-[12px] text-ink-400 mt-3">Take it from Leave → Apply for leave → Comp-Off.</div>
        </Card>
      </div>
      {data && !data.rule_active && <div className="rounded-xl bg-amber-50 text-amber-800 px-4 py-3 text-[13px] mb-6">Comp-Off credit starts once the company confirms the legal review of the exchange rate. Your hours are still recorded and reviewed.</div>}

      <Card>
        <CardHeader icon={CalendarClock} title="My holiday work" />
        {data && reqs.length === 0 && <EmptyState icon={CalendarClock} title="No holiday work yet" body="Requests and their status show up here." />}
        <ul className="divide-y divide-ink-100">
          {reqs.map((h) => (
            <li key={h.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-900 flex flex-wrap items-center gap-2">{day(h.work_date)} <span className="font-normal text-ink-500 text-[13px]">· {h.day_label}</span>{h.emergency && <Pill tone="red">Emergency</Pill>}</div>
                <div className="text-[12.5px] text-ink-500 truncate">{h.title} · {h.worked_seconds ? `${hm(h.worked_seconds)} worked` : `${h.expected_hours} h planned`}{h.units ? ` · ${h.units === 1 ? '1 day' : '½ day'} comp-off` : ''}</div>
                {(h.review_note || h.decision_note) && <div className="text-[12.5px] text-ink-500 mt-1">Super Admin: “{h.review_note || h.decision_note}”</div>}
              </div>
              <Pill tone={HW_STATUS[h.status].tone} dot>{HW_STATUS[h.status].label}</Pill>
              {h.cancellable && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act(h, 'cancel')}><X size={14} /> Cancel</button>}
              {!h.can_work && h.running && <button className="btn-outline btn-sm" onClick={() => setEnding(h)}><Square size={13} /> End work</button>}
            </li>
          ))}
        </ul>
      </Card>

      {form && data && <RequestForm eligible={data.eligible} onClose={() => setForm(false)} onDone={() => { setForm(false); reload() }} />}
      {ending && <EndModal h={ending} onClose={() => setEnding(null)} onDone={() => { setEnding(null); reload() }} />}
    </>
  )
}

function ActiveCard({ h, busy, onAct, onEnd }: { h: HolidayWorkDTO; busy: boolean; onAct: (h: HolidayWorkDTO, a: 'start' | 'pause') => void; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!h.running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [h.running])
  const secs = workedNow(h, now)
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2 mb-1"><Pill tone={h.running ? 'green' : 'amber'} dot>{h.running ? 'Working' : h.intervals.length ? 'Paused' : 'Ready to start'}</Pill>{h.emergency && <Pill tone="red">Emergency</Pill>}</div>
      <div className="font-bold text-ink-900 text-lg">{h.title}</div>
      <div className="text-[13px] text-ink-500">{day(h.work_date)} · {h.day_label} · from home</div>
      <div className="flex items-center gap-3 my-5"><Timer size={22} className="text-brand-600" /><span className="text-[38px] font-bold tabular-nums text-ink-900 leading-none">{hm(secs)}</span><span className="text-ink-400 text-[13px]">of {h.expected_hours} h planned</span></div>
      <div className="flex flex-wrap gap-2">
        {h.running
          ? <button className="btn-outline h-11 px-5 rounded-xl" disabled={busy} onClick={() => onAct(h, 'pause')}><Pause size={16} /> Pause</button>
          : <button className="btn-brand h-11 px-5 rounded-xl" disabled={busy} onClick={() => onAct(h, 'start')}><Play size={16} /> {h.intervals.length ? 'Resume' : 'Start work'}</button>}
        {h.intervals.length > 0 && <button className="btn-outline h-11 px-5 rounded-xl" disabled={busy} onClick={onEnd}><Square size={15} /> End work</button>}
      </div>
    </Card>
  )
}

function RequestForm({ eligible, onClose, onDone }: { eligible: { date: string; label: string }[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const today = istToday()
  const todayOk = eligible.some((e) => e.date === today)
  const [emergency, setEmergency] = useState(false)
  const [date, setDate] = useState('')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [hours, setHours] = useState('4')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const workDate = emergency ? today : date
  const h = Number(hours)
  const blocker = !workDate ? 'Pick a date' : title.trim().length < 3 ? 'Name the project or task' : purpose.trim().length < 10 ? 'Explain why (10+ characters)' : !(h >= 1 && h <= 12) ? 'Hours: 1 to 12' : null

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await api.requestHolidayWork({ work_date: workDate, title, purpose, expected_hours: h, emergency })
      toast({ tone: 'success', title: emergency ? 'Emergency work started' : 'Request sent', body: emergency ? 'You can start now. The Super Admin reviews it afterwards.' : 'The Super Admin has been notified.' })
      onDone()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Drawer open onClose={onClose} title="Request holiday work" subtitle="Weekly offs and your holidays only · work from home"
      footer={<div className="w-full flex items-center justify-between gap-3"><span className="text-[12.5px] text-ink-500">{blocker ?? (emergency ? 'Starts now; reviewed afterwards' : 'Needs approval before the day')}</span>
        <button className="btn-brand h-10 px-5 rounded-xl" disabled={!!blocker || busy} onClick={submit}>{emergency ? 'Start emergency work' : 'Send request'}</button></div>}>
      <div className="space-y-5">
        {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2.5 text-[13px]">{err}</div>}
        {todayOk && (
          <label className={clsx('flex gap-3 rounded-xl p-3 ring-1 cursor-pointer', emergency ? 'ring-rose-300 bg-rose-50/60' : 'ring-ink-200')}>
            <input type="checkbox" className="mt-1" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} />
            <span><span className="font-semibold text-[13.5px] text-ink-900 flex items-center gap-1.5"><Siren size={14} className="text-rose-600" /> Emergency today</span>
              <span className="block text-[12px] text-ink-500">Something urgent came up and can't wait for approval. You start now; the Super Admin reviews it after.</span></span>
          </label>
        )}
        {!emergency && (
          <div>
            <label className="label" htmlFor="hw-date">Date</label>
            {eligible.length ? (
              <select id="hw-date" className="input" value={date} onChange={(e) => setDate(e.target.value)}>
                <option value="">Choose a weekly off or holiday</option>
                {eligible.map((e) => <option key={e.date} value={e.date}>{day(e.date)} · {e.label}</option>)}
              </select>
            ) : <div className="text-[13px] text-ink-500">No eligible dates in the next 60 days.</div>}
          </div>
        )}
        <div><label className="label" htmlFor="hw-title">Project or task</label><input id="hw-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client release hotfix" /></div>
        <div><label className="label" htmlFor="hw-purpose">Why it can't wait</label><textarea id="hw-purpose" className="input min-h-24 py-2" maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
        <div><label className="label" htmlFor="hw-hours">Expected hours</label><input id="hw-hours" type="number" min={1} max={12} step={0.5} className="input w-32" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        <p className="text-[12px] text-ink-400">Hours alone don't earn comp-off. After you end work, the Super Admin verifies the time: 8 h or more is usually 1 day, 4 h or more ½ day.</p>
      </div>
    </Drawer>
  )
}

function EndModal({ h, onClose, onDone }: { h: HolidayWorkDTO; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const [summary, setSummary] = useState('')
  const [refs, setRefs] = useState('')
  const [busy, setBusy] = useState(false)
  const end = async () => {
    setBusy(true)
    try { const r = await api.holidayWorkAction(h.id, 'stop', { summary, task_refs: refs }); toast({ tone: 'success', title: `Work ended · ${hm(r.worked_seconds)}`, body: 'Awaiting the Super Admin’s verification.' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t end work', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="End holiday work"
      footer={<><button className="btn-ghost" onClick={onClose}>Back</button><button className="btn-brand px-5 rounded-xl h-10" disabled={busy || summary.trim().length < 10} onClick={end}>End work</button></>}>
      <div className="space-y-4">
        <div className="text-[13px] text-ink-500">{hm(workedNow(h))} recorded. Describe what you did; the Super Admin uses it to verify the time.</div>
        <div><label className="label" htmlFor="hw-sum">Work summary</label><textarea id="hw-sum" className="input min-h-24 py-2" value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        <div><label className="label" htmlFor="hw-refs">Task or commit links (optional)</label><input id="hw-refs" className="input" maxLength={500} value={refs} onChange={(e) => setRefs(e.target.value)} /></div>
      </div>
    </Modal>
  )
}
