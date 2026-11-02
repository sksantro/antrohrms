import clsx from 'clsx'
import { CalendarDays, CalendarPlus, Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, Drawer, EmptyState, PageHeader, Pill, ProgressRing, Segmented, type Tone } from '../components/ui'
import { api, type LeaveCat, type LeaveDTO, type LeaveStatusDTO } from '../lib/api'
import { fmtDate, istToday } from '../lib/format'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'

export const LEAVE_STATUS: Record<LeaveStatusDTO, { label: string; tone: Tone }> = {
  SUBMITTED: { label: 'Pending approval', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  NEEDS_CHANGES: { label: 'Needs changes', tone: 'blue' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
}
export const CAT: Record<LeaveCat, { name: string; color: string; hint: string }> = {
  CL: { name: 'Casual Leave', color: '#3d5afe', hint: 'Personal work, short notice' },
  SL: { name: 'Sick Leave', color: '#12b6ff', hint: 'Illness or a doctor’s visit' },
  EL: { name: 'Earned Leave', color: '#8b3dff', hint: 'Planned vacation' },
}
export const range = (l: Pick<LeaveDTO, 'start' | 'end' | 'half_day'>) =>
  l.start === l.end ? `${fmtDate(l.start, { weekday: 'short', day: 'numeric', month: 'short' })}${l.half_day ? ' · half day' : ''}`
    : `${fmtDate(l.start, { day: 'numeric', month: 'short' })} – ${fmtDate(l.end, { day: 'numeric', month: 'short' })}`

export default function Leave() {
  const year = Number(istToday().slice(0, 4))
  const bal = useApi(() => api.leaveBalances(year), [year])
  const list = useApi(() => api.myLeave(), [])
  const [tab, setTab] = useState<'all' | 'open' | 'closed'>('all')
  const [form, setForm] = useState<LeaveDTO | 'new' | null>(null)
  const { toast } = useStore()
  const refresh = () => { bal.reload(); list.reload() }

  const cancel = async (l: LeaveDTO) => {
    try { await api.cancelLeave(l.id); toast({ tone: 'success', title: 'Leave cancelled', body: l.status === 'APPROVED' ? 'The days are back in your balance.' : undefined }); refresh() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t cancel', body: errMsg(e) }) }
  }
  const rows = (list.data?.requests ?? []).filter((l) => tab === 'all' || (tab === 'open') === ['SUBMITTED', 'NEEDS_CHANGES'].includes(l.status))

  return (
    <>
      <PageHeader eyebrow={`Leave year ${year}`} title="Leave" subtitle="Casual, Sick and Earned Leave. The Super Admin approves every request."
        actions={<button className="btn-brand h-11 px-5 rounded-xl" onClick={() => setForm('new')}><CalendarPlus size={17} /> Apply for leave</button>} />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {(['CL', 'SL', 'EL'] as LeaveCat[]).map((c, i) => {
          const b = bal.data?.balances[c]
          return (
            <Card key={c} className="p-5 flex items-center gap-5 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <ProgressRing value={b && b.granted ? b.available / b.granted : 0} size={82} stroke={8} color={CAT[c].color}>
                <div className="text-center leading-none"><div className="text-[20px] font-bold text-ink-900">{b ? b.available : '–'}</div><div className="text-[10.5px] text-ink-500 mt-1">left</div></div>
              </ProgressRing>
              <div className="min-w-0">
                <div className="font-bold text-ink-900">{CAT[c].name}</div>
                <div className="text-[12.5px] text-ink-500 mt-1">{b ? <>{b.granted} granted · {b.used} used{b.pending ? <> · <span className="text-amber-600 font-medium">{b.pending} pending</span></> : null}</> : 'Loading…'}</div>
              </div>
            </Card>
          )
        })}
      </div>
      {bal.data?.on_probation && <p className="text-[12.5px] text-ink-500 -mt-3 mb-5">You’re on probation. You can still request leave as the law allows.</p>}

      <Card>
        <CardHeader title="My requests" icon={CalendarDays} action={<Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]} />} />
        <div className="px-5 pb-5">
          {list.error && <p className="text-rose-700 text-sm">{list.error}</p>}
          {list.data && rows.length === 0 && <EmptyState icon={CalendarDays} title="No leave requests here" body="Apply for leave and it shows up here with its status." />}
          <ul className="space-y-2.5">
            {rows.map((l) => (
              <li key={l.id} className="rounded-2xl ring-1 ring-ink-100 bg-white p-4 flex flex-wrap items-center gap-4">
                <span className="size-11 rounded-xl grid place-items-center text-white font-bold text-[13px] shrink-0" style={{ background: CAT[l.category].color }}>{l.category}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink-900">{range(l)} <span className="text-ink-400 font-normal">· {Number(l.days)} day{Number(l.days) === 1 ? '' : 's'}</span></div>
                  <div className="text-[12.5px] text-ink-500 truncate">{l.reason}</div>
                  {l.decision_note && <div className={clsx('text-[12.5px] mt-1', l.status === 'NEEDS_CHANGES' ? 'text-sky-700' : 'text-ink-500')}>Super Admin: “{l.decision_note}”</div>}
                </div>
                <Pill tone={LEAVE_STATUS[l.status].tone} dot>{LEAVE_STATUS[l.status].label}</Pill>
                <div className="flex gap-1">
                  {l.status === 'NEEDS_CHANGES' && <button className="btn-outline btn-sm" onClick={() => setForm(l)}><Pencil size={13} /> Edit</button>}
                  {l.cancellable && <button className="btn-ghost btn-sm text-rose-600" onClick={() => cancel(l)}><X size={14} /> Cancel</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {form && <LeaveForm edit={form === 'new' ? null : form} balances={bal.data?.balances} onClose={() => setForm(null)} onDone={() => { setForm(null); refresh() }} />}
    </>
  )
}

function LeaveForm({ edit, balances, onClose, onDone }: { edit: LeaveDTO | null; balances?: Record<LeaveCat, { available: number }>; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const [cat, setCat] = useState<LeaveCat>(edit?.category ?? 'CL')
  const [start, setStart] = useState(edit?.start ?? '')
  const [end, setEnd] = useState(edit?.end ?? '')
  const [half, setHalf] = useState(edit?.half_day ?? false)
  const [reason, setReason] = useState(edit?.reason ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ days: number; holidays: { date: string; name: string }[] } | null>(null)
  const to = half ? start : end
  useEffect(() => {
    if (!start || !to || to < start) { setPreview(null); return }
    let live = true
    api.leavePreview(start, to).then((p) => live && setPreview(p)).catch(() => live && setPreview(null))
    return () => { live = false }
  }, [start, to])
  const days = half ? (preview?.days ? 0.5 : 0) : preview?.days ?? 0
  const avail = balances?.[cat].available ?? 0
  const extra = edit && edit.category === cat ? Number(edit.days) : 0 // its own hold comes back when editing
  const short = days > avail + extra
  const blocker = !start ? 'Pick a start date' : !half && !end ? 'Pick an end date' : to < start ? 'The end date is before the start date'
    : preview && preview.days === 0 ? 'Those dates are all weekends or holidays' : short ? `Only ${avail + extra} ${cat} day(s) available` : reason.trim().length < 3 ? 'Add a short reason' : null

  const submit = async () => {
    setBusy(true); setErr(null)
    const body = { category: cat, start, end: to, half_day: half, reason }
    try {
      await (edit ? api.resubmitLeave(edit.id, body) : api.applyLeave(body))
      toast({ tone: 'success', title: edit ? 'Request sent again' : 'Leave request sent', body: 'The Super Admin has been notified by email.' })
      onDone()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Drawer open onClose={onClose} title={edit ? 'Edit leave request' : 'Apply for leave'} subtitle="Weekends and holidays are not counted"
      footer={<div className="w-full flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-ink-500">{blocker ?? `${days} working day${days === 1 ? '' : 's'} from ${CAT[cat].name}`}</span>
        <button className="btn-brand h-10 px-5 rounded-xl" disabled={!!blocker || busy} onClick={submit}>{edit ? 'Send again' : 'Send request'}</button>
      </div>}>
      <div className="space-y-5">
        {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2.5 text-[13px]">{err}</div>}
        {edit?.decision_note && <div className="rounded-xl bg-sky-50 text-sky-800 px-3 py-2.5 text-[13px]"><b>Super Admin asked:</b> {edit.decision_note}</div>}
        <div>
          <div className="label">Type of leave</div>
          <div className="grid grid-cols-3 gap-2">
            {(['CL', 'SL', 'EL'] as LeaveCat[]).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={clsx('rounded-xl p-3 text-left ring-1 transition', cat === c ? 'ring-brand-400 bg-brand-50/70' : 'ring-ink-200 hover:ring-brand-300')}>
                <div className="font-semibold text-[13.5px] text-ink-900">{CAT[c].name}</div>
                <div className="text-[11.5px] text-ink-500 mt-0.5">{balances ? `${balances[c].available} left` : CAT[c].hint}</div>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13.5px] text-ink-700 cursor-pointer select-none">
          <input type="checkbox" className="size-4 accent-brand-600" checked={half} onChange={(e) => setHalf(e.target.checked)} /> Half day (one date)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="lv-start">{half ? 'Date' : 'From'}</label><input id="lv-start" type="date" className="input" value={start} onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value) }} /></div>
          {!half && <div><label className="label" htmlFor="lv-end">To</label><input id="lv-end" type="date" className="input" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></div>}
        </div>
        {preview && preview.holidays.length > 0 && (
          <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-600">Not counted: {preview.holidays.map((h) => `${h.name} (${fmtDate(h.date, { day: 'numeric', month: 'short' })})`).join(', ')}</div>
        )}
        <div>
          <label className="label" htmlFor="lv-reason">Reason</label>
          <textarea id="lv-reason" className="input h-24 py-2 resize-none" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family function in my hometown" />
        </div>
        <p className="text-[12px] text-ink-400">Past dates (up to 30 days back) are allowed, for example sick leave after you’re back. The Super Admin decides those with a note.</p>
      </div>
    </Drawer>
  )
}
