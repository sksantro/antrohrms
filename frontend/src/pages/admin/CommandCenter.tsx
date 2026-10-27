import { AlertTriangle, ArrowUpRight, Inbox, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, PageHeader, Segmented } from '../../components/ui'
import type { ExceptionItem } from '../../lib/api'
import { fmtTime, greeting } from '../../lib/format'
import { useMe, useStore } from '../../lib/store'
import { KIND_ICON } from './Approvals'
import { ExceptionsList, KpiRow, LiveTable, ReviewDrawer, useAttendanceAdmin } from './AttendanceAdmin'

export default function CommandCenter() {
  const { approvals, leaves } = useStore()
  const me = useMe()
  const { board, items, error, load, elapsed, serverNow } = useAttendanceAdmin()
  const [filter, setFilter] = useState('ALL')
  const [item, setItem] = useState<ExceptionItem | null>(null)
  const [dayId, setDayId] = useState<string | null>(null)
  const pendingLeaves = leaves.filter((l) => l.status === 'SUBMITTED').length
  const close = () => { setItem(null); setDayId(null) }

  return (
    <>
      <PageHeader eyebrow="Super Admin" title={<>{greeting()}, {me.name.split(' ')[0]}</>}
        subtitle={board ? `${board.rows.length} active people · ${board.counts.WORKING} working right now` : 'Loading today…'}
        actions={<button className="text-[12px] text-ink-400 flex items-center gap-1.5 hover:text-ink-700" onClick={load}><RefreshCw size={13} /> Updated {fmtTime(serverNow)}</button>} />
      {error && <div role="alert" className="mb-5 rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-[13px]">{error.message}</div>}
      <KpiRow board={board} />

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <Card>
          <CardHeader title="Live attendance" subtitle="Current working & break status"
            action={<Segmented value={filter} onChange={setFilter} options={[{ value: 'ALL', label: 'All' }, { value: 'WORKING', label: 'Working' }, { value: 'ON_TEA', label: 'Tea' }, { value: 'ON_LUNCH', label: 'Lunch' }]} />} />
          <LiveTable board={board} elapsed={elapsed} serverNow={serverNow} filter={filter} onOpen={setDayId} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Attendance exceptions" subtitle={items ? `${items.length} to review · never auto-deducted` : ''} icon={AlertTriangle}
              action={<Link to="/admin/attendance" className="btn-ghost btn-sm">All <ArrowUpRight size={14} /></Link>} />
            <ExceptionsList items={items} onOpen={setItem} compact />
          </Card>

          <Card className="overflow-hidden">
            <div className="p-5 bg-gradient-to-br from-brand-600 to-brand-900 text-white relative">
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/70 text-[13px] font-medium"><Inbox size={16} /> Approval inbox</div>
                <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-200 text-amber-900">Sample data · P2</span>
              </div>
              <div className="font-display text-[40px] font-bold mt-1 leading-none">{approvals.length + pendingLeaves}</div>
              <div className="text-white/60 text-[12.5px] mt-1">{pendingLeaves} leave · {approvals.length} other requests</div>
            </div>
            <ul className="p-2">
              {approvals.slice(0, 3).map((a) => {
                const I = KIND_ICON[a.kind]
                return (
                  <li key={a.id}>
                    <Link to="/admin/approvals" className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50">
                      <span className="size-9 rounded-xl bg-ink-50 text-ink-500 grid place-items-center shrink-0"><I size={16} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink-900 truncate">{a.title}</div>
                        <div className="text-[12px] text-ink-400 truncate">{a.who} · {a.age} ago</div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
      <ReviewDrawer item={item} dayId={dayId} onClose={close} onDone={() => { close(); load() }} />
    </>
  )
}
