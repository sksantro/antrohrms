import clsx from 'clsx'
import { AlertTriangle, ArrowUpRight, Coffee, Inbox, MapPinOff, RefreshCw, UserX, Users, UtensilsCrossed, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardHeader, PageHeader, Pill, Segmented, StatTile, type Tone } from '../../components/ui'
import { EMPLOYEES, type LiveState } from '../../lib/data'
import { fmtTime, greeting, hm } from '../../lib/format'
import { useMe, useStore } from '../../lib/store'
import { KIND_ICON } from './Approvals'

export const LIVE: Record<LiveState, { label: string; tone: Tone }> = {
  WORKING: { label: 'Working', tone: 'green' },
  ON_TEA: { label: 'Tea break', tone: 'amber' },
  ON_LUNCH: { label: 'Lunch', tone: 'blue' },
  CHECKED_OUT: { label: 'Checked out', tone: 'gray' },
  NOT_ARRIVED: { label: 'Not arrived', tone: 'red' },
  VERIFICATION_REQUIRED: { label: 'Proof review', tone: 'violet' },
}

export function LiveTable({ filter }: { filter?: LiveState | 'ALL' }) {
  const rows = EMPLOYEES.filter((e) => !filter || filter === 'ALL' || e.live === filter)
  return (
    <div className="px-3 pb-3 overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead><tr><th className="table-th">Employee</th><th className="table-th">First in</th><th className="table-th">Status</th><th className="table-th">Net work</th><th className="table-th">Exception</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="hover:bg-ink-50/60 cursor-pointer">
              <td className="table-td">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} hue={e.hue} size={32} />
                  <div><div className="font-semibold text-ink-900 text-[13.5px]">{e.name}</div><div className="text-[12px] text-ink-400">{e.designation}</div></div>
                </div>
              </td>
              <td className="table-td tabular-nums">{e.firstIn ?? '—'}</td>
              <td className="table-td"><Pill tone={LIVE[e.live].tone} dot>{LIVE[e.live].label}</Pill></td>
              <td className="table-td">
                <div className="flex items-center gap-2.5">
                  <div className="w-20 h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-sky-400" style={{ width: `${Math.min(100, (e.workMin / 480) * 100)}%` }} /></div>
                  <span className="tabular-nums text-[13px] whitespace-nowrap">{hm(e.workMin * 60)}</span>
                </div>
              </td>
              <td className="table-td">{e.exception ? <span className="inline-flex items-center gap-1.5 text-[12.5px] text-amber-700"><AlertTriangle size={14} />{e.exception}</span> : <span className="text-ink-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CommandCenter() {
  const { approvals, leaves, now } = useStore()
  const me = useMe()
  const [filter, setFilter] = useState<'ALL' | LiveState>('ALL')
  const count = (s: LiveState) => EMPLOYEES.filter((e) => e.live === s).length
  const exceptions = EMPLOYEES.filter((e) => e.exception)
  const pendingLeaves = leaves.filter((l) => l.status === 'SUBMITTED').length

  return (
    <>
      <PageHeader eyebrow="Super Admin" sample="P1" title={<>{greeting()}, {me.name.split(' ')[0]}</>} subtitle={`${EMPLOYEES.length} people · ${count('WORKING')} working right now`}
        actions={<span className="text-[12px] text-ink-400 flex items-center gap-1.5"><RefreshCw size={13} /> Updated {fmtTime(now)}</span>} />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatTile label="Working" value={count('WORKING')} icon={Users} tone="green" hint="In office, verified" />
        <StatTile label="Tea break" value={count('ON_TEA')} icon={Coffee} tone="amber" hint="1 over 15 min" />
        <StatTile label="Lunch" value={count('ON_LUNCH')} icon={UtensilsCrossed} tone="blue" />
        <StatTile label="Checked out" value={count('CHECKED_OUT')} icon={Clock} tone="gray" />
        <StatTile label="Not arrived" value={count('NOT_ARRIVED')} icon={UserX} tone="red" hint="No leave on record" />
        <StatTile label="Proof review" value={count('VERIFICATION_REQUIRED')} icon={MapPinOff} tone="violet" hint="Geo inconclusive" />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <Card>
          <CardHeader title="Live attendance" subtitle="Current working & break status"
            action={<Segmented value={filter} onChange={setFilter} options={[{ value: 'ALL', label: 'All' }, { value: 'WORKING', label: 'Working' }, { value: 'ON_TEA', label: 'Tea' }, { value: 'ON_LUNCH', label: 'Lunch' }]} />} />
          <LiveTable filter={filter} />
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="p-5 bg-gradient-to-br from-brand-600 to-brand-900 text-white relative">
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
              <div className="flex items-center gap-2 text-white/70 text-[13px] font-medium"><Inbox size={16} /> Approval inbox</div>
              <div className="font-display text-[40px] font-bold mt-1 leading-none">{approvals.length + pendingLeaves}</div>
              <div className="text-white/60 text-[12.5px] mt-1">{pendingLeaves} leave · {approvals.length} other requests waiting on you</div>
            </div>
            <ul className="p-2">
              {approvals.slice(0, 4).map((a) => {
                const I = KIND_ICON[a.kind]
                return (
                  <li key={a.id}>
                    <Link to="/admin/approvals" className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50">
                      <span className="size-9 rounded-xl bg-ink-50 text-ink-500 grid place-items-center shrink-0"><I size={16} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink-900 truncate">{a.title}</div>
                        <div className="text-[12px] text-ink-400 truncate">{a.who} · {a.age} ago</div>
                      </div>
                      {a.urgent && <span className="size-2 rounded-full bg-rose-500" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="px-5 pb-4"><Link to="/admin/approvals" className="btn-outline w-full">Open inbox <ArrowUpRight size={15} /></Link></div>
          </Card>

          <Card>
            <CardHeader title="Today’s exceptions" subtitle="Review, never auto-deducted" icon={AlertTriangle} />
            <ul className="px-5 pb-5 space-y-3">
              {exceptions.map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <Avatar name={e.name} hue={e.hue} size={30} />
                  <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold truncate">{e.name}</div><div className={clsx('text-[12px]', e.exception?.includes('Geo') ? 'text-brand-600' : 'text-amber-600')}>{e.exception}</div></div>
                  <button className="btn-ghost btn-sm">Review</button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
