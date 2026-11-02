import { CalendarCheck, CalendarHeart, ChevronRight, Clock, Inbox, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../../components/ui'
import { api } from '../../lib/api'
import { istToday } from '../../lib/format'
import { useApi } from '../../lib/useApi'

/** Everything waiting for the Super Admin, in one place. Each row opens the screen where it's decided. */
export default function Approvals() {
  const year = Number(istToday().slice(0, 4))
  const leave = useApi(() => api.adminLeave('SUBMITTED'), [])
  const att = useApi(() => api.exceptions(), [])
  const cal = useApi(() => Promise.all([api.calendars(year), api.calendars(year + 1)]), [year])
  const items = att.data?.items ?? []
  const wfh = items.filter((i) => i.kind === 'WFH_REQUEST').length
  const calendars = cal.data?.flatMap((c) => c.calendars).filter((c) => c.status === 'SUBMITTED').length ?? 0
  const rows: { icon: LucideIcon; title: string; body: string; n: number | null; to: string }[] = [
    { icon: CalendarCheck, title: 'Leave requests', body: 'CL, SL and EL waiting for your decision', n: leave.data ? leave.data.requests.length : null, to: '/console/leave' },
    { icon: Clock, title: 'Work-from-home requests', body: 'Planned and emergency WFH days', n: att.data ? wfh : null, to: '/console/attendance' },
    { icon: Clock, title: 'Attendance reviews', body: 'Location, early check-outs, corrections, WFH days to verify', n: att.data ? items.length - wfh : null, to: '/console/attendance' },
    { icon: CalendarHeart, title: 'Holiday calendar', body: 'Revisions HR sent for publishing', n: cal.data ? calendars : null, to: '/hr/holidays' },
  ]
  const total = rows.reduce((s, r) => s + (r.n ?? 0), 0)
  return (
    <>
      <PageHeader eyebrow="Console" title="Approval inbox" subtitle={total ? `${total} item${total === 1 ? '' : 's'} waiting for you` : 'You’re all caught up'} />
      <Card className="divide-y divide-ink-100">
        {rows.map((r) => (
          <Link key={r.title} to={r.to} className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50/60">
            <span className="size-11 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><r.icon size={20} /></span>
            <div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{r.title}</div><div className="text-[12.5px] text-ink-500">{r.body}</div></div>
            <span className={`min-w-8 h-8 px-2 rounded-full grid place-items-center text-[13px] font-bold ${r.n ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-400'}`}>{r.n ?? '…'}</span>
            <ChevronRight size={18} className="text-ink-300" />
          </Link>
        ))}
      </Card>
      {total === 0 && leave.data && att.data && <div className="mt-8 text-center text-ink-400"><Inbox className="mx-auto mb-2" /> Nothing needs you right now.</div>}
    </>
  )
}
