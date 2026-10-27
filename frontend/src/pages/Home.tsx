import { ArrowUpRight, Briefcase, CalendarDays, ClipboardCheck, FileSignature, Receipt, Star, Sun, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import TimeTracker from '../components/TimeTracker'
import { Bar, Card, CardHeader, Pill, StatTile } from '../components/ui'
import { HOLIDAYS, LEAVE_META, PAYSLIPS, type LeaveType } from '../lib/data'
import { fmtDate, fmtMonth, greeting, inr } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useMe, useStore } from '../lib/store'
import { leaveBalance } from './Leave'

export default function Home() {
  const me = useMe()
  const probationEnd = useAuth().me?.employee?.probation_end
  const { role, leaves, optional } = useStore()
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = HOLIDAYS.filter((h) => h.date >= today).slice(0, 3)
  const pending = leaves.filter((l) => l.empId === me.id && l.status === 'SUBMITTED')
  const slip = PAYSLIPS[0]
  const bal = leaveBalance(leaves, me.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="eyebrow">{fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <span title="Time tracking, leave and payslips connect to the server in phases P1–P2." className="text-[10.5px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">Sample data · P1–P2</span>
          </div>
          <h1 className="text-[28px] font-bold">{greeting()}, {me.name.split(' ')[0]} <span className="inline-block origin-bottom-right">✨</span></h1>
          <p className="text-ink-500 mt-1">Here’s your day at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={me.status === 'PROBATION' ? 'amber' : 'green'} dot>{me.status === 'PROBATION' && probationEnd ? `Probation · ends ${fmtDate(probationEnd, { day: 'numeric', month: 'short' })}` : 'Confirmed'}</Pill>
          <Pill tone="gray">{me.code}</Pill>
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '60ms' }}><TimeTracker /></div>

      {role === 'HR_OPERATIONS' && (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 animate-fade-up">
          <StatTile label="Interviews today" value="2" icon={Briefcase} hint="Harsh V. · 15:00, Aditya P. · 17:00" />
          <StatTile label="Candidates waiting" value="3" icon={UserPlus} tone="blue" hint="2 need scheduling" />
          <StatTile label="Missing docs" value="3" icon={ClipboardCheck} tone="amber" hint="Fatima S. · PAN, education" />
          <StatTile label="Letter drafts" value="1" icon={FileSignature} tone="violet" hint="Awaiting Admin approval" />
          <StatTile label="Exit checklists" value="1" icon={ClipboardCheck} tone="red" hint="Tara M. · 4 of 9 done" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <CardHeader icon={CalendarDays} title="Leave balance" subtitle={pending.length ? `${pending.length} request awaiting approval` : 'No pending requests'}
            action={<Link to="/app/leave" className="btn-ghost btn-sm">Apply <ArrowUpRight size={14} /></Link>} />
          <div className="px-5 pb-5 space-y-4">
            {(Object.keys(LEAVE_META) as LeaveType[]).map((t) => (
              <div key={t}>
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="font-medium text-ink-700">{LEAVE_META[t].name}</span>
                  <span className="tabular-nums text-ink-500"><b className="text-ink-900">{bal[t].available}</b> / {LEAVE_META[t].quota}</span>
                </div>
                <Bar value={bal[t].available / LEAVE_META[t].quota} hex={LEAVE_META[t].color} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: '160ms' }}>
          <CardHeader icon={Sun} title="Upcoming holidays" subtitle={`${optional.length} of 2 optional chosen`}
            action={<Link to="/app/holidays" className="btn-ghost btn-sm">Calendar <ArrowUpRight size={14} /></Link>} />
          <ul className="px-5 pb-5 space-y-2">
            {upcoming.map((h) => {
              const d = new Date(h.date + 'T00:00:00+05:30')
              return (
                <li key={h.date} className="flex items-center gap-3.5 p-2.5 -mx-2.5 rounded-xl hover:bg-ink-50">
                  <div className="w-12 text-center rounded-xl bg-gradient-to-b from-brand-50 to-white ring-1 ring-brand-100 py-1.5">
                    <div className="text-[10px] font-bold uppercase text-brand-600">{fmtDate(d, { month: 'short' })}</div>
                    <div className="font-display font-bold text-lg leading-none text-ink-900">{d.getDate()}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[13.5px]">{h.name}</div>
                    <div className="text-[12px] text-ink-500">{fmtDate(d, { weekday: 'long' })}</div>
                  </div>
                  <Pill tone={h.type === 'FIXED' ? 'violet' : optional.includes(h.date) ? 'green' : 'blue'}>{h.type === 'FIXED' ? 'Fixed' : optional.includes(h.date) ? 'Your pick' : 'Optional'}</Pill>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card className="animate-fade-up overflow-hidden" style={{ animationDelay: '200ms' }}>
          <CardHeader icon={Receipt} title="Latest payslip" subtitle={fmtMonth(slip.month)}
            action={<Link to="/app/payslips" className="btn-ghost btn-sm">All <ArrowUpRight size={14} /></Link>} />
          <div className="px-5 pb-5">
            <div className="rounded-2xl bg-gradient-to-br from-ink-900 to-ink-800 text-white p-5 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-10 size-32 rounded-full bg-brand-500/30 blur-2xl" />
              <div className="text-white/60 text-[12px] font-medium">Net pay</div>
              <div className="font-display text-[32px] font-bold mt-1 tabular-nums">{inr(slip.net)}</div>
              <div className="flex gap-5 mt-3 text-[12px] text-white/60">
                <span>Gross <b className="text-white/90">{inr(slip.gross)}</b></span>
                <span>Paid days <b className="text-white/90">{slip.paidDays}</b></span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-amber-50/70 ring-1 ring-amber-100">
              <div className="flex items-center gap-2.5 text-[13px]"><Star size={16} className="text-amber-500" /><span><b>Annual review</b> opens 16 Aug 2027</span></div>
              <Pill tone="amber">Upcoming</Pill>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
