import clsx from 'clsx'
import { CalendarCheck, CalendarClock, CalendarHeart, Check, ChevronRight, Clock, House, Inbox, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardHeader, PageHeader, Pill } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate, istToday } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { CAT, range } from '../Leave'

type Row = { key: string; who: string; title: string; detail: string; badge?: string; approve: (note: string) => Promise<unknown>; reject: (note: string) => Promise<unknown> }

/** Everything waiting for the Super Admin. Leave and WFH are decided right here; the rest opens its own screen. */
export default function Approvals() {
  const year = Number(istToday().slice(0, 4))
  const leave = useApi(() => api.adminLeave('SUBMITTED'), [])
  const att = useApi(() => api.exceptions(), [])
  const hw = useApi(() => api.adminHolidayWork('REQUESTED,AWAITING_REVIEW'), [])
  const cal = useApi(() => Promise.all([api.calendars(year), api.calendars(year + 1)]), [year])
  const items = att.data?.items ?? []
  const wfh = items.filter((i) => i.kind === 'WFH_REQUEST')
  const reviews = items.length - wfh.length
  const calendars = cal.data?.flatMap((c) => c.calendars).filter((c) => c.status === 'SUBMITTED').length ?? 0

  const rows: Row[] = [
    ...(leave.data?.requests ?? []).map((l) => ({
      key: l.id, who: l.employee!.display_name, title: `${CAT[l.category].name} · ${Number(l.days)} day${Number(l.days) === 1 ? '' : 's'}`,
      detail: `${range(l)} · “${l.reason}”`, badge: l.start < istToday() ? 'Past dates: add a note' : undefined,
      approve: (n: string) => api.decideLeave(l.id, 'APPROVE', n), reject: (n: string) => api.decideLeave(l.id, 'REJECT', n),
    })),
    ...wfh.map((w) => ({
      key: w.wfh_request_id!, who: w.employee, title: w.emergency ? 'Emergency work from home' : 'Work from home',
      detail: `${fmtDate(w.work_date, { weekday: 'short', day: 'numeric', month: 'short' })} · “${w.reason ?? ''}” · ${w.used_this_month ?? 0} this month`, badge: w.emergency ? 'Already started' : undefined,
      approve: (n: string) => api.decideWfh(w.wfh_request_id!, 'APPROVE', n || 'Approved'), reject: (n: string) => api.decideWfh(w.wfh_request_id!, 'REJECT', n),
    })),
  ]
  const reload = () => { leave.reload(); att.reload() }
  const holidayWork = hw.data?.requests.length ?? 0
  const total = rows.length + reviews + calendars + holidayWork

  return (
    <>
      <PageHeader eyebrow="Console" title="Approval inbox" subtitle={total ? `${total} item${total === 1 ? '' : 's'} waiting for you` : 'You’re all caught up'} />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <Card>
          <CardHeader icon={Inbox} title="Decide now" subtitle="Leave and work-from-home requests" />
          {leave.data && att.data && rows.length === 0 && <p className="px-5 pb-8 pt-2 text-center text-ink-400 text-[13.5px]">Nothing to decide. New requests show up here and on your bell.</p>}
          <ul className="divide-y divide-ink-100">{rows.map((r) => <Decision key={r.key} row={r} onDone={reload} />)}</ul>
        </Card>
        <div className="space-y-4">
          {[
            { icon: Clock, title: 'Attendance reviews', body: 'Location, early check-outs, corrections, WFH days', n: att.data ? reviews : null, to: '/console/attendance' },
            { icon: CalendarClock, title: 'Holiday work', body: 'Approve weekend work, verify hours, grant comp-off', n: hw.data ? holidayWork : null, to: '/console/holiday-work' },
            { icon: CalendarHeart, title: 'Holiday calendar', body: 'Revisions waiting to publish', n: cal.data ? calendars : null, to: '/hr/holidays' },
            { icon: CalendarCheck, title: 'All leave requests', body: 'History and decided requests', n: null, to: '/console/leave' },
          ].map((x) => (
            <Link key={x.title} to={x.to}><Card className="p-4 flex items-center gap-3 hover:ring-brand-200 transition">
              <span className="size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><x.icon size={18} /></span>
              <div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{x.title}</div><div className="text-[12px] text-ink-500">{x.body}</div></div>
              {x.n !== null && <span className={clsx('min-w-7 h-7 px-2 rounded-full grid place-items-center text-[12.5px] font-bold', x.n ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-400')}>{x.n}</span>}
              <ChevronRight size={17} className="text-ink-300" />
            </Card></Link>
          ))}
        </div>
      </div>
    </>
  )
}

function Decision({ row, onDone }: { row: Row; onDone: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const go = async (fn: (n: string) => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(note.trim()); toast({ tone: 'success', title, body: 'The employee is notified.' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={row.who} size={38} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink-900 flex flex-wrap items-center gap-2">{row.who} <span className="font-normal text-ink-500 text-[13px]">· {row.title}</span>{row.badge && <Pill tone="amber">{row.badge}</Pill>}</div>
          <div className="text-[12.5px] text-ink-500 truncate flex items-center gap-1">{row.title.includes('home') && <House size={12} />}{row.detail}</div>
        </div>
        {!rejecting && (
          <div className="flex gap-2">
            <button className="btn-outline btn-sm" disabled={busy} onClick={() => setRejecting(true)}><X size={14} /> Reject</button>
            <button className="btn-primary btn-sm" disabled={busy} onClick={() => go(row.approve, 'Approved')}><Check size={14} /> Approve</button>
          </div>
        )}
      </div>
      <input className="input h-9 mt-3" placeholder={rejecting ? 'Reason for rejecting (required)' : 'Optional note (required for past-date leave)'} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      {rejecting && (
        <div className="flex justify-end gap-2 mt-2">
          <button className="btn-ghost btn-sm" onClick={() => setRejecting(false)}>Back</button>
          <button className="btn-sm btn bg-rose-600 text-white hover:bg-rose-700" disabled={busy || note.trim().length < 3} onClick={() => go(row.reject, 'Rejected')}>Confirm reject</button>
        </div>
      )}
    </li>
  )
}
