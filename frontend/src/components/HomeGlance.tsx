import { CalendarDays, CalendarHeart, PartyPopper, Receipt } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { fmtDate, inr2, istToday, monthName } from '../lib/format'
import { useApi } from '../lib/useApi'
import { Avatar, Card } from './ui'

/** Home "at a glance": leave left, next holiday, latest payslip and this month's work anniversaries. */
export default function HomeGlance() {
  const today = istToday()
  const year = Number(today.slice(0, 4))
  const bal = useApi(() => api.leaveBalances(year), [year])
  const cal = useApi(() => api.myCalendar(year), [year])
  const pay = useApi(() => api.myPayslips(), [])
  const dir = useApi(() => api.directory(), [])
  const next = cal.data?.holidays.find((h) => h.date >= today && (h.kind === 'FIXED' || h.chosen))
  const slip = pay.data?.payslips[0]
  const month = today.slice(5, 7)
  const annivs = (dir.data?.people ?? []).filter((p) => p.joined.slice(5, 7) === month && p.joined.slice(0, 4) < today.slice(0, 4))
    .sort((a, b) => a.joined.slice(8).localeCompare(b.joined.slice(8)))

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Box to="/app/leave" icon={CalendarDays} title="Leave left" tone="bg-brand-50 text-brand-600">
        {bal.data ? (
          <div className="flex gap-4">
            {(['CL', 'SL', 'EL'] as const).map((c) => <div key={c}><div className="text-[22px] font-bold text-ink-900 leading-none">{bal.data!.balances[c].available}</div><div className="text-[11.5px] text-ink-500 mt-1">{c}</div></div>)}
          </div>
        ) : <Skeleton />}
      </Box>
      <Box to="/app/holidays" icon={CalendarHeart} title="Next holiday" tone="bg-rose-50 text-rose-500">
        {cal.data ? next ? <><div className="font-bold text-ink-900 truncate">{next.name}</div><div className="text-[12.5px] text-ink-500">{fmtDate(next.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div></>
          : <div className="text-[13px] text-ink-500">{cal.data.published ? 'No more this year' : 'Calendar not published yet'}</div> : <Skeleton />}
      </Box>
      <Box to="/app/payslips" icon={Receipt} title="Latest payslip" tone="bg-emerald-50 text-emerald-600">
        {pay.data ? slip ? <><div className="font-bold text-ink-900">{monthName(slip.year, slip.month)}</div><div className="text-[12.5px] text-ink-500">Net {inr2(slip.net)}</div></>
          : <div className="text-[13px] text-ink-500">Your first payslip appears after payroll is approved</div> : <Skeleton />}
      </Box>
      <Box to="/app/people" icon={PartyPopper} title="Work anniversaries this month" tone="bg-amber-50 text-amber-600">
        {dir.data ? annivs.length ? (
          <ul className="space-y-1.5">{annivs.slice(0, 3).map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-[12.5px]"><Avatar name={p.display_name} size={22} /><span className="truncate flex-1 text-ink-800">{p.display_name}</span><span className="text-ink-500 shrink-0">{Number(today.slice(0, 4)) - Number(p.joined.slice(0, 4))} yr · {Number(p.joined.slice(8))} {fmtDate(p.joined, { month: 'short' })}</span></li>
          ))}{annivs.length > 3 && <li className="text-[12px] text-ink-400">+{annivs.length - 3} more</li>}</ul>
        ) : <div className="text-[13px] text-ink-500">None this month</div> : <Skeleton />}
      </Box>
    </div>
  )
}

function Box({ to, icon: Icon, title, tone, children }: { to: string; icon: typeof Receipt; title: string; tone: string; children: ReactNode }) {
  return (
    <Link to={to}><Card className="p-5 h-full hover:ring-brand-200 transition animate-fade-up">
      <div className="flex items-center gap-2.5 mb-3"><span className={`size-9 rounded-xl grid place-items-center ${tone}`}><Icon size={17} /></span><span className="text-[13px] font-semibold text-ink-700">{title}</span></div>
      {children}
    </Card></Link>
  )
}

const Skeleton = () => <div className="h-9 rounded-lg bg-ink-50 animate-pulse" />
