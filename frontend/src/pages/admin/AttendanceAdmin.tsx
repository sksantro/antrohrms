import clsx from 'clsx'
import { AlertCircle, AlertTriangle, BellRing, CheckCircle2, Clock, Coffee, FilePen, House, LogOut, MapPinOff, RefreshCw, Users, UserX, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, Card, CardHeader, Drawer, EmptyState, PageHeader, Pill, Segmented, StatTile, type Tone } from '../../components/ui'
import { api, ApiError, type AdminDay, type ExceptionItem, type LiveBoard, type LiveRow } from '../../lib/api'
import { fmtDate, fmtTime, hm } from '../../lib/format'
import { useStore } from '../../lib/store'
import { Timeline } from '../Attendance'

const STATE: Record<LiveRow['state'], { label: string; tone: Tone }> = {
  WORKING: { label: 'Working', tone: 'green' }, ON_TEA: { label: 'Tea break', tone: 'amber' }, ON_LUNCH: { label: 'Lunch', tone: 'blue' },
  CHECKED_OUT: { label: 'Checked out', tone: 'gray' }, NOT_ARRIVED: { label: 'Not arrived', tone: 'red' }, NOT_CHECKED_IN: { label: 'Not arrived', tone: 'red' },
}
const KIND: Record<ExceptionItem['kind'], { icon: typeof AlertTriangle; tone: string }> = {
  GEO_FAILED: { icon: MapPinOff, tone: 'bg-rose-50 text-rose-600' },
  GEO_INCONCLUSIVE: { icon: MapPinOff, tone: 'bg-amber-50 text-amber-600' },
  MISSING_CHECKOUT: { icon: LogOut, tone: 'bg-rose-50 text-rose-600' },
  SHORTFALL: { icon: Clock, tone: 'bg-amber-50 text-amber-600' },
  CORRECTION: { icon: FilePen, tone: 'bg-brand-50 text-brand-600' },
  WFH_REQUEST: { icon: House, tone: 'bg-brand-50 text-brand-600' },
  WFH_REVIEW: { icon: House, tone: 'bg-sky-50 text-sky-600' },
}
const hueOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)

/** Live board + exceptions, refreshed every 30 s and on focus; timers tick from the server anchor. */
export function useAttendanceAdmin() {
  const { now } = useStore()
  const [board, setBoard] = useState<LiveBoard | null>(null)
  const [items, setItems] = useState<ExceptionItem[] | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const anchor = useRef({ client: Date.now(), server: Date.now() })
  const load = useCallback(async () => {
    try {
      const [b, x] = await Promise.all([api.liveBoard(), api.exceptions()])
      anchor.current = { client: Date.now(), server: Date.parse(b.server_now) }
      setBoard(b); setItems(x.items); setError(null)
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(0, null)) }
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 30_000)
    window.addEventListener('focus', load)
    return () => { clearInterval(id); window.removeEventListener('focus', load) }
  }, [load])
  const elapsed = board ? Math.max(0, Math.floor((anchor.current.server + (now - anchor.current.client) - Date.parse(board.server_now)) / 1000)) : 0
  return { board, items, error, load, elapsed, serverNow: anchor.current.server + (now - anchor.current.client) }
}

export function KpiRow({ board }: { board: LiveBoard | null }) {
  const c = board?.counts
  const v = (n?: number) => (c ? n : '—')
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <StatTile label="Working" value={v(c?.WORKING)} icon={Users} tone="green" />
      <StatTile label="Tea break" value={v(c?.ON_TEA)} icon={Coffee} tone="amber" />
      <StatTile label="Lunch" value={v(c?.ON_LUNCH)} icon={UtensilsCrossed} tone="blue" />
      <StatTile label="Checked out" value={v(c?.CHECKED_OUT)} icon={Clock} tone="gray" />
      <StatTile label="Not arrived" value={v(c?.NOT_ARRIVED)} icon={UserX} tone="red" hint="Leave shows here from P2" />
      <StatTile label="Location review" value={v(c?.PROOF_REVIEW)} icon={MapPinOff} tone="violet" />
    </div>
  )
}

export function LiveTable({ board, elapsed, serverNow, filter, onOpen }: { board: LiveBoard | null; elapsed: number; serverNow: number; filter: string; onOpen: (dayId: string) => void }) {
  if (!board) return <div className="p-5 space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-12 rounded-xl bg-ink-50 animate-pulse" />)}</div>
  const rows = board.rows.filter((r) => filter === 'ALL' || r.state === filter)
  if (board.rows.length === 0) return <EmptyState icon={Users} title="No active employees yet" body="Add your team from People. They’ll appear here once they’re active." />
  if (rows.length === 0) return <EmptyState icon={Users} title="Nobody in this state right now" />
  return (
    <div className="px-3 pb-3 overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead><tr><th className="table-th">Employee</th><th className="table-th">In</th><th className="table-th">Status</th><th className="table-th">Net work</th><th className="table-th">Flags</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const work = r.work_seconds + (r.state === 'WORKING' ? elapsed : 0)
            const brk = r.break_started_at ? Math.floor((serverNow - Date.parse(r.break_started_at)) / 1000) : 0
            const limit = r.state === 'ON_TEA' ? board.thresholds.tea_exceed_seconds : board.thresholds.lunch_exceed_seconds
            return (
              <tr key={r.employee.id} className={clsx(r.day_id && 'hover:bg-ink-50/60 cursor-pointer')} onClick={() => r.day_id && onOpen(r.day_id)}
                tabIndex={r.day_id ? 0 : -1} onKeyDown={(e) => e.key === 'Enter' && r.day_id && onOpen(r.day_id)}>
                <td className="table-td">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.employee.display_name} hue={hueOf(r.employee.id)} size={32} />
                    <div><div className="font-semibold text-ink-900 text-[13.5px]">{r.employee.display_name}</div><div className="text-[12px] text-ink-400">{r.employee.designation}</div></div>
                  </div>
                </td>
                <td className="table-td tabular-nums">{r.check_in_at ? fmtTime(new Date(r.check_in_at)) : '—'}</td>
                <td className="table-td">
                  <Pill tone={STATE[r.state].tone} dot>{STATE[r.state].label}</Pill>
                  {r.break_started_at && <span className={clsx('ml-2 text-[12px] tabular-nums', brk > limit ? 'text-rose-600 font-semibold' : 'text-ink-400')}>{Math.floor(brk / 60)}m</span>}
                </td>
                <td className="table-td">
                  <div className="flex items-center gap-2.5">
                    <div className="w-20 h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-sky-400" style={{ width: `${Math.min(100, (work / board.thresholds.work_seconds) * 100)}%` }} /></div>
                    <span className="tabular-nums text-[13px] whitespace-nowrap">{hm(work)}</span>
                  </div>
                </td>
                <td className="table-td">{r.flags.length ? <span className="inline-flex items-center gap-1.5 text-[12.5px] text-amber-700"><AlertTriangle size={14} />{r.flags.join(' · ')}</span> : <span className="text-ink-300">—</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ExceptionsList({ items, onOpen, compact }: { items: ExceptionItem[] | null; onOpen: (x: ExceptionItem) => void; compact?: boolean }) {
  if (!items) return <div className="px-5 pb-5 space-y-2">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-11 rounded-xl bg-ink-50 animate-pulse" />)}</div>
  if (items.length === 0) return <EmptyState icon={CheckCircle2} title="All clear" body="No attendance exceptions need your review." />
  return (
    <ul className="px-3 pb-3">
      {(compact ? items.slice(0, 6) : items).map((x, i) => {
        const k = KIND[x.kind]
        return (
          <li key={i}>
            <button className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-ink-50 text-left" onClick={() => onOpen(x)}>
              <span className={clsx('size-9 rounded-xl grid place-items-center shrink-0', k.tone)}><k.icon size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink-900 truncate">{x.employee}</div>
                <div className="text-[12px] text-ink-500 truncate">{x.title} · {fmtDate(x.work_date, { day: 'numeric', month: 'short' })}</div>
              </div>
              <span className="text-[12px] font-semibold text-brand-600">Review</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Evidence + decisions for one day. Decisions never change worked time except an approved correction. */
export function ReviewDrawer({ item, dayId, onClose, onDone }: { item: ExceptionItem | null; dayId: string | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const id = item?.day_id ?? dayId
  const [day, setDay] = useState<AdminDay | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setDay(null); setErr(null); setNote('')
    if (id) api.adminDay(id).then(setDay).catch((e) => setErr(e instanceof ApiError ? e.message : 'Couldn’t load this day.'))
  }, [id])
  if (item?.kind === 'WFH_REQUEST') return <WfhRequestDrawer item={item} onClose={onClose} onDone={onDone} />
  if (!id) return <Drawer open={false} onClose={onClose} title=""><></></Drawer>

  const decide = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title, body: 'Recorded in the audit trail.' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: e instanceof ApiError ? e.message : undefined }) }
    finally { setBusy(false) }
  }
  const needsProof = day && (day.proof === 'INCONCLUSIVE' || day.proof === 'FAILED')
  const wfhDay = day?.mode === 'WFH'
  const pendingFix = item?.kind === 'CORRECTION' ? item : null
  const okNote = note.trim().length >= 3

  return (
    <Drawer open onClose={onClose} title={day ? day.employee.display_name : 'Attendance day'} subtitle={day ? `${fmtDate(day.work_date, { weekday: 'long', day: 'numeric', month: 'short' })} · ${day.employee.employee_code ?? ''}` : ''}
      footer={day && (
        <div className="w-full space-y-3">
          <textarea className="input h-16 py-2 resize-none" placeholder="Note for the audit trail (required)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Decision note" />
          <div className="flex flex-wrap justify-end gap-2">
            {pendingFix && <>
              <button className="btn-outline" disabled={busy || !okNote} onClick={() => decide(() => api.decideCorrection(pendingFix.correction_id!, 'REJECT', note), 'Correction rejected')}>Reject</button>
              <button className="btn-primary" disabled={busy || !okNote} onClick={() => decide(() => api.decideCorrection(pendingFix.correction_id!, 'APPROVE', note), 'Correction approved')}>Approve correction</button>
            </>}
            {!pendingFix && needsProof && <button className="btn-primary" disabled={busy || !okNote} onClick={() => decide(() => api.reviewDay(id, 'ACCEPT_PROOF', note), 'Location accepted')}>Accept location (verified manually)</button>}
            {!pendingFix && day.review_status !== 'REVIEWED' && <button className={needsProof ? 'btn-outline' : 'btn-primary'} disabled={busy || !okNote} onClick={() => decide(() => api.reviewDay(id, 'ACKNOWLEDGE', note), wfhDay ? 'Work-from-home day verified' : 'Marked as reviewed')}>{wfhDay ? 'Verify WFH day' : 'Mark reviewed'}</button>}
          </div>
        </div>
      )}>
      {err ? <EmptyState icon={AlertCircle} title="Couldn’t load" body={err} /> : !day ? <div className="h-40 rounded-xl bg-ink-50 animate-pulse" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            {[['Net work', hm(day.work_seconds)], ['Presence', hm(day.presence_seconds)], ['Breaks', `${hm(day.tea_seconds + day.lunch_seconds)} · ${day.tea_count} tea`], ['Location', day.proof.replace('_', ' ').toLowerCase()]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50/70 p-3"><div className="text-ink-400 text-[12px]">{k}</div><div className="font-semibold text-ink-800 mt-0.5 first-letter:uppercase">{v}</div></div>
            ))}
          </div>
          {day.proof_note && (wfhDay
            ? <div className="rounded-xl bg-brand-50 text-brand-800 p-3 text-[13px] flex gap-2"><House size={16} className="shrink-0 mt-px" />{day.proof_note}</div>
            : <div className="rounded-xl bg-amber-50 text-amber-800 p-3 text-[13px]"><b>Location:</b> {day.proof_note}</div>)}
          {wfhDay && (
            <div className="space-y-2 text-[13px]">
              <div className="rounded-xl bg-ink-50 p-3 whitespace-pre-wrap"><b>Morning plan:</b> {day.plan || '—'}</div>
              <div className="rounded-xl bg-ink-50 p-3 whitespace-pre-wrap"><b>End-of-day summary:</b> {day.summary || (day.status === 'OPEN' ? 'Still working' : '—')}</div>
              {day.presence && (
                <div className={clsx('rounded-xl p-3 flex gap-2', day.presence.missed ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800')}>
                  <BellRing size={16} className="shrink-0 mt-px" />
                  <span><b>“Are you there?” checks:</b> {day.presence.answered} answered, {day.presence.missed} missed{day.presence.total ? ` of ${day.presence.total}` : ''}
                    {day.presence_checks?.length ? <span className="block text-[12px] opacity-80 mt-1">{day.presence_checks.map((c) => `${c.due_at ? fmtTime(new Date(c.due_at)) : ''} ${c.status.toLowerCase()}`).join(' · ')}</span> : null}
                  </span>
                </div>
              )}
            </div>
          )}
          {day.shortfall_reason && <div className="rounded-xl bg-ink-50 p-3 text-[13px]"><b>Employee’s reason:</b> {day.shortfall_reason}</div>}
          {pendingFix && <div className="rounded-xl bg-brand-50 text-brand-900 p-3 text-[13px]"><b>Requested:</b> {pendingFix.title.replace('Correction: ', '')} at {fmtTime(new Date(pendingFix.proposed_at!))}<br /><span className="text-brand-700">“{pendingFix.reason}”</span></div>}
          <div>
            <h3 className="font-semibold text-[14px] mb-3">Event log</h3>
            <Timeline events={day.events} />
          </div>
          {day.events.some((e) => e.distance_m != null || e.accuracy_m != null) && (
            <div>
              <h3 className="font-semibold text-[14px] mb-2">Location readings <span className="text-[12px] text-ink-400 font-normal">· Super Admin only</span></h3>
              <ul className="text-[12.5px] text-ink-600 space-y-1">
                {day.events.filter((e) => e.accuracy_m != null || e.distance_m != null).map((e, i) => (
                  <li key={i} className="tabular-nums">{fmtTime(new Date(e.at))} · {e.distance_m != null ? `${e.distance_m} m from office` : 'distance unknown'} · ±{e.accuracy_m ?? '?'} m</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

/** Approve or reject a work-from-home request (normal or emergency). */
function WfhRequestDrawer({ item, onClose, onDone }: { item: ExceptionItem; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const decide = async (d: 'APPROVE' | 'REJECT') => {
    setBusy(true)
    try { await api.decideWfh(item.wfh_request_id!, d, note); toast({ tone: 'success', title: d === 'APPROVE' ? 'Work from home approved' : 'Work from home rejected', body: 'Recorded in the audit trail.' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: e instanceof ApiError ? e.message : undefined }) }
    finally { setBusy(false) }
  }
  const ok = note.trim().length >= 3
  return (
    <Drawer open onClose={onClose} title={item.employee} subtitle={`${item.emergency ? 'Emergency work from home' : 'Work-from-home request'} · ${fmtDate(item.work_date, { weekday: 'long', day: 'numeric', month: 'short' })}`}
      footer={
        <div className="w-full space-y-3">
          <textarea className="input h-16 py-2 resize-none" placeholder="Note for the employee and audit trail (required)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Decision note" />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" disabled={busy || !ok} onClick={() => decide('REJECT')}>Reject</button>
            <button className="btn-primary" disabled={busy || !ok} onClick={() => decide('APPROVE')}>Approve</button>
          </div>
        </div>
      }>
      <div className="space-y-3 text-[13px]">
        {item.emergency && <div className="rounded-xl bg-rose-50 text-rose-800 p-3">Already started today as an emergency. Rejecting keeps the hours recorded but marks the day as rejected WFH.</div>}
        <div className="rounded-xl bg-ink-50 p-3 whitespace-pre-wrap"><b>Reason:</b> {item.reason}</div>
        <div className="rounded-xl bg-ink-50 p-3"><b>This month:</b> {item.used_this_month} work-from-home day{item.used_this_month === 1 ? '' : 's'} requested or approved (including this one)</div>
      </div>
    </Drawer>
  )
}

export default function AttendanceAdmin() {
  const { board, items, error, load, elapsed, serverNow } = useAttendanceAdmin()
  const [filter, setFilter] = useState('ALL')
  const [item, setItem] = useState<ExceptionItem | null>(null)
  const [dayId, setDayId] = useState<string | null>(null)
  const close = () => { setItem(null); setDayId(null) }
  return (
    <>
      <PageHeader eyebrow="Super Admin" title="Attendance" subtitle={board ? `${fmtDate(board.work_date, { weekday: 'long', day: 'numeric', month: 'long' })} · refreshes every 30 seconds` : 'Loading…'}
        actions={<button className="btn-outline" onClick={load}><RefreshCw size={15} /> Refresh</button>} />
      {error && <div role="alert" className="mb-5 rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-[13px]">{error.message}</div>}
      <KpiRow board={board} />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <Card>
          <CardHeader title="Live status" subtitle="Click a person to see their event log"
            action={<Segmented value={filter} onChange={setFilter} options={[{ value: 'ALL', label: 'All' }, { value: 'WORKING', label: 'Working' }, { value: 'ON_TEA', label: 'Tea' }, { value: 'ON_LUNCH', label: 'Lunch' }, { value: 'NOT_ARRIVED', label: 'Not in' }]} />} />
          <LiveTable board={board} elapsed={elapsed} serverNow={serverNow} filter={filter} onOpen={setDayId} />
        </Card>
        <Card className="h-fit">
          <CardHeader title="Exceptions queue" subtitle={items ? `${items.length} to review · never auto-deducted` : ''} icon={AlertTriangle} />
          <ExceptionsList items={items} onOpen={setItem} />
        </Card>
      </div>
      <ReviewDrawer item={item} dayId={dayId} onClose={close} onDone={() => { close(); load() }} />
    </>
  )
}
