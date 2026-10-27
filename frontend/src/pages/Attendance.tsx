import clsx from 'clsx'
import { Coffee, LogIn, LogOut, Play, UtensilsCrossed } from 'lucide-react'
import TimeTracker from '../components/TimeTracker'
import { Card, CardHeader, PageHeader, Pill, type Tone } from '../components/ui'
import { fmtTime, hm } from '../lib/format'
import { useStore, type AttEventType } from '../lib/store'

const EV: Record<AttEventType, { label: string; icon: typeof LogIn; cls: string }> = {
  CHECK_IN: { label: 'Checked in · location verified', icon: LogIn, cls: 'bg-emerald-100 text-emerald-700' },
  START_TEA: { label: 'Started tea break', icon: Coffee, cls: 'bg-amber-100 text-amber-700' },
  END_TEA: { label: 'Resumed work', icon: Play, cls: 'bg-brand-100 text-brand-700' },
  START_LUNCH: { label: 'Started lunch', icon: UtensilsCrossed, cls: 'bg-sky-100 text-sky-700' },
  END_LUNCH: { label: 'Resumed work', icon: Play, cls: 'bg-brand-100 text-brand-700' },
  CHECK_OUT: { label: 'Checked out', icon: LogOut, cls: 'bg-ink-100 text-ink-700' },
}

type Day = { date: string; dow: string; kind: 'work' | 'off' | 'holiday' | 'leave'; first?: string; last?: string; work?: number; brk?: number; status?: { label: string; tone: Tone } }
const HISTORY: Day[] = [
  { date: '26 Oct', dow: 'Mon', kind: 'work', first: '09:28', last: '18:52', work: 29160, brk: 4680, status: { label: 'Compliant', tone: 'green' } },
  { date: '25 Oct', dow: 'Sun', kind: 'off' },
  { date: '24 Oct', dow: 'Sat', kind: 'off' },
  { date: '23 Oct', dow: 'Fri', kind: 'work', first: '09:41', last: '18:20', work: 27120, brk: 4020, status: { label: 'Shortfall · reason given', tone: 'amber' } },
  { date: '22 Oct', dow: 'Thu', kind: 'work', first: '09:30', last: '18:45', work: 28920, brk: 4380, status: { label: 'Compliant', tone: 'green' } },
  { date: '21 Oct', dow: 'Wed', kind: 'work', first: '09:25', last: '18:40', work: 28860, brk: 4440, status: { label: 'Compliant', tone: 'green' } },
  { date: '20 Oct', dow: 'Tue', kind: 'holiday', status: { label: 'Dussehra', tone: 'violet' } },
  { date: '19 Oct', dow: 'Mon', kind: 'work', first: '09:33', last: '18:58', work: 29400, brk: 4500, status: { label: 'Compliant', tone: 'green' } },
  { date: '16 Oct', dow: 'Fri', kind: 'leave', status: { label: 'CL · approved', tone: 'blue' } },
]

export default function Attendance() {
  const { events } = useStore()
  return (
    <>
      <PageHeader eyebrow="Self service" title="My Attendance" sample="P1" subtitle="Onsite check-in with office geofence · Monday to Friday" />
      <TimeTracker compact />

      <div className="grid xl:grid-cols-[340px_minmax(0,1fr)] gap-6 mt-6">
        <Card>
          <CardHeader title="Today’s timeline" subtitle="Immutable event log" />
          <ol className="px-5 pb-5 relative">
            {events.length === 0 && <li className="text-ink-400 text-[13px] py-6 text-center">No punches yet today.</li>}
            {events.map((e, i) => {
              const m = EV[e.type]
              return (
                <li key={i} className="flex gap-3.5 relative pb-5 last:pb-0">
                  {i < events.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-ink-100" />}
                  <span className={clsx('size-8 rounded-full grid place-items-center shrink-0', m.cls)}><m.icon size={15} /></span>
                  <div className="pt-1">
                    <div className="text-[13.5px] font-medium text-ink-800">{m.label}</div>
                    <div className="text-[12px] text-ink-400 tabular-nums">{fmtTime(e.at)}{e.note && <> · “{e.note}”</>}</div>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>

        <Card>
          <CardHeader title="History" subtitle="Last two weeks" action={<button className="btn-outline btn-sm">Request correction</button>} />
          <div className="px-3 pb-3 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="table-th">Date</th><th className="table-th">First in</th><th className="table-th">Last out</th><th className="table-th">Net work</th><th className="table-th">Breaks</th><th className="table-th">Status</th></tr></thead>
              <tbody>
                {HISTORY.map((d) => (
                  <tr key={d.date} className={clsx(d.kind !== 'work' && 'bg-ink-50/40')}>
                    <td className="table-td"><span className="font-semibold text-ink-900">{d.date}</span> <span className="text-ink-400 text-[12px]">{d.dow}</span></td>
                    {d.kind === 'work' ? (
                      <>
                        <td className="table-td tabular-nums">{d.first}</td>
                        <td className="table-td tabular-nums">{d.last}</td>
                        <td className="table-td">
                          <div className="flex items-center gap-2.5">
                            <div className="w-16 h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className={clsx('h-full rounded-full', d.work! >= 28800 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.min(100, (d.work! / 28800) * 100)}%` }} /></div>
                            <span className="tabular-nums">{hm(d.work!)}</span>
                          </div>
                        </td>
                        <td className="table-td tabular-nums">{hm(d.brk!)}</td>
                      </>
                    ) : (
                      <td className="table-td text-ink-400" colSpan={4}>{d.kind === 'off' ? 'Weekly off' : d.kind === 'holiday' ? 'Public holiday' : 'On approved leave'}</td>
                    )}
                    <td className="table-td">{d.status ? <Pill tone={d.status.tone} dot>{d.status.label}</Pill> : <span className="text-ink-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
