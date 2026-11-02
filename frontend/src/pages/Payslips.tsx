import clsx from 'clsx'
import { Download, Receipt, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Logo } from '../components/Shell'
import { Card, EmptyState, PageHeader, Pill } from '../components/ui'
import { api, type PayslipDTO } from '../lib/api'
import { fmtDate, inr2, monthName } from '../lib/format'
import { useApi } from '../lib/useApi'

export default function Payslips() {
  const { data, error } = useApi(() => api.myPayslips(), [])
  const [sel, setSel] = useState<string | null>(null)
  const slips = data?.payslips ?? []
  const slip = slips.find((s) => s.id === sel) ?? slips[0]

  return (
    <>
      <PageHeader eyebrow="Private to you" title="My Payslips" subtitle="Payslips appear once the Super Admin approves the month. Approved slips are never edited."
        actions={<Pill tone="green"><ShieldCheck size={13} /> Only you and the Super Admin can see these</Pill>} />
      {error && <Card className="p-5 text-rose-700">{error}</Card>}
      {data && slips.length === 0 && <Card><EmptyState icon={Receipt} title="No payslips yet" body="Your first payslip shows up here after that month’s payroll is approved." /></Card>}
      {slip && (
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
          <Card className="p-2">
            {slips.map((s) => (
              <button key={s.id} onClick={() => setSel(s.id)} className={clsx('w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition', s.id === slip.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-ink-50')}>
                <span className="font-semibold">{monthName(s.year, s.month)}</span>
                <span className="text-[13px] tabular-nums text-ink-500">{inr2(s.net)}</span>
              </button>
            ))}
          </Card>
          <div className="min-w-0">
            <div className="flex justify-end mb-3"><button className="btn-outline" onClick={() => window.print()}><Download size={16} /> Download PDF</button></div>
            <PayslipDoc slip={slip} />
          </div>
        </div>
      )}
    </>
  )
}

/** The payslip as printed (BRD §8.5). Rendered from the frozen snapshot only; "Download PDF" prints this area. */
export function PayslipDoc({ slip }: { slip: PayslipDTO }) {
  const d = slip.data
  const leave = Object.entries(d.info.leave_days)
  return (
    <Card className="print-area p-8 text-ink-800 text-[13.5px]">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-ink-100">
        <div><Logo /><div className="mt-2 font-semibold text-ink-900">{d.employer.name}</div></div>
        <div className="text-right">
          <div className="text-[20px] font-bold text-ink-900">Payslip · {monthName(d.period.year, d.period.month)}</div>
          <div className="text-ink-500 text-[12.5px]">{slip.issued_at ? `Issued ${fmtDate(slip.issued_at)}` : 'Draft — not issued'}</div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 py-5 border-b border-ink-100">
        {[['Employee', d.employee.name], ['Employee code', d.employee.code ?? '—'], ['Designation', d.employee.designation], ['Department', d.employee.department],
          ['Date of joining', fmtDate(d.employee.joined)], ['Days in month', d.period.days], ['Paid days', Number(d.paid_days)], ['Unpaid days (LOP)', Number(d.unpaid_days)]]
          .map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3"><span className="text-ink-500">{k}</span><span className="font-medium text-right">{v}</span></div>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-8 py-5">
        <Lines title="Earnings" rows={d.earnings} total={d.gross} totalLabel="Gross earnings" />
        <Lines title="Deductions" rows={d.deductions} total={d.total_deductions} totalLabel="Total deductions" />
      </div>
      <div className="rounded-2xl hero-blue text-white px-6 py-4 flex items-center justify-between">
        <span className="font-semibold">Net pay</span><span className="text-[24px] font-bold tabular-nums">{inr2(d.net)}</span>
      </div>
      {(leave.length > 0) && <p className="mt-4 text-[12.5px] text-ink-500">Approved leave this month: {leave.map(([k, v]) => `${k} ${v}`).join(', ')} (paid).</p>}
      <p className="mt-4 text-[11px] text-ink-400 break-all">Computer-generated payslip; no signature needed. Document ID {slip.id} · checksum {slip.digest.slice(0, 16)}</p>
    </Card>
  )
}

function Lines({ title, rows, total, totalLabel }: { title: string; rows: PayslipDTO['data']['earnings']; total: string; totalLabel: string }) {
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <ul className="space-y-1.5">
        {rows.filter((r) => Number(r.amount) !== 0 || r.code === 'PT').map((r, i) => (
          <li key={i} className="flex justify-between gap-3"><span>{r.name}{r.note ? <span className="text-ink-400"> · {r.note}</span> : null}</span><span className="tabular-nums">{inr2(r.amount)}</span></li>
        ))}
      </ul>
      <div className="flex justify-between gap-3 mt-3 pt-3 border-t border-ink-100 font-semibold text-ink-900"><span>{totalLabel}</span><span className="tabular-nums">{inr2(total)}</span></div>
    </div>
  )
}
