import clsx from 'clsx'
import { Download, Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Logo } from '../components/Shell'
import { Card, PageHeader, Pill } from '../components/ui'
import { PAYSLIPS, SALARY_COMPONENTS } from '../lib/data'
import { fmtMonth, inr } from '../lib/format'
import { useMe, useStore } from '../lib/store'

export default function Payslips() {
  const me = useMe()
  const { toast } = useStore()
  const [sel, setSel] = useState(PAYSLIPS[0].month)
  const slip = PAYSLIPS.find((p) => p.month === sel)!
  const scale = slip.gross / 30000
  const earnings = SALARY_COMPONENTS.filter((c) => c.type === 'EARNING')
  const deductions = SALARY_COMPONENTS.filter((c) => c.type === 'DEDUCTION')

  return (
    <>
      <PageHeader eyebrow="Self service · private to you" title="My Payslips" sample="P2" subtitle="Approved payslips only. Previous months are locked and never edited."
        actions={<Pill tone="green"><ShieldCheck size={13} /> Only you and Super Admin can see this</Pill>} />

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
        <Card className="p-2 h-fit">
          {PAYSLIPS.map((p) => (
            <button key={p.month} onClick={() => setSel(p.month)}
              className={clsx('w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition', sel === p.month ? 'bg-ink-900 text-white' : 'hover:bg-ink-50')}>
              <div>
                <div className="font-semibold text-[14px]">{fmtMonth(p.month)}</div>
                <div className={clsx('text-[12px]', sel === p.month ? 'text-white/60' : 'text-ink-400')}>{p.paidDays} paid days</div>
              </div>
              <div className="font-display font-bold tabular-nums">{inr(p.net)}</div>
            </button>
          ))}
          <div className="px-4 py-3 text-[12px] text-ink-400 flex items-center gap-2"><Lock size={13} /> October 2026 · available after payroll approval</div>
        </Card>

        <Card className="overflow-hidden animate-fade-up" key={sel}>
          <div className="p-7 border-b border-ink-100 flex flex-wrap justify-between gap-4 bg-gradient-to-br from-white to-brand-50/40">
            <div>
              <Logo />
              <div className="text-[12px] text-ink-500 mt-3 leading-relaxed">Antro-Pai Technology Pvt. Ltd.<br />Hyderabad, Telangana</div>
            </div>
            <div className="text-right">
              <div className="eyebrow">Payslip</div>
              <div className="font-display font-bold text-xl mt-1">{fmtMonth(slip.month)}</div>
              <div className="text-[12px] text-ink-400 mt-1">Doc ID PS-{slip.month.replace('-', '')}-{me.code} · v1</div>
            </div>
          </div>
          <div className="px-7 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px] border-b border-ink-100">
            {[['Employee', me.name], ['Code', me.code], ['Designation', me.designation], ['Paid / Unpaid', `${slip.paidDays} / 0`]].map(([k, v]) => (
              <div key={k}><div className="text-ink-400 text-[12px]">{k}</div><div className="font-semibold text-ink-800 mt-0.5">{v}</div></div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2">
            <div className="p-7 sm:border-r border-ink-100">
              <div className="eyebrow mb-3">Earnings</div>
              {earnings.map((c) => <Row key={c.code} k={c.name} v={inr(Math.round(c.amount * scale))} />)}
              <Row k="Gross earnings" v={inr(slip.gross)} bold />
            </div>
            <div className="p-7">
              <div className="eyebrow mb-3">Deductions</div>
              {deductions.map((c) => <Row key={c.code} k={c.name} v={inr(c.amount)} />)}
              <Row k="Provident Fund" v={<Pill tone="gray">Not active</Pill>} />
              <Row k="TDS" v={<Pill tone="gray">Not active</Pill>} />
              <Row k="Total deductions" v={inr(slip.deductions)} bold />
            </div>
          </div>
          <div className="mx-7 mb-7 rounded-2xl bg-ink-900 text-white p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-white/60 text-[12.5px]">Net payable</div>
              <div className="font-display text-[34px] font-bold tabular-nums">{inr(slip.net)}</div>
              <div className="text-[12px] text-white/50">Bank A/C •••• 4821</div>
            </div>
            <button className="btn bg-white text-ink-900 hover:bg-brand-50" onClick={() => toast({ tone: 'success', title: 'Download started', body: 'Secure link valid for 5 minutes.' })}><Download size={17} /> Download PDF</button>
          </div>
        </Card>
      </div>
    </>
  )
}

function Row({ k, v, bold }: { k: string; v: React.ReactNode; bold?: boolean }) {
  return (
    <div className={clsx('flex justify-between items-center py-2 text-[13.5px]', bold ? 'border-t border-ink-100 mt-2 pt-3 font-semibold text-ink-900' : 'text-ink-600')}>
      <span>{k}</span><span className="tabular-nums">{v}</span>
    </div>
  )
}
