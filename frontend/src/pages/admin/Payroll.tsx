import clsx from 'clsx'
import { AlertTriangle, Calculator, Check, Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Card, CardHeader, Modal, PageHeader, Pill, StatTile } from '../../components/ui'
import { EMPLOYEES } from '../../lib/data'
import { inr } from '../../lib/format'
import { useStore } from '../../lib/store'

const STEPS = ['Month open', 'Data captured', 'Draft calculated', 'Exceptions review', 'Approval pending', 'Approved & locked', 'Payslips sent']

// Telangana PT slabs (versioned rule, BRD §8.3)
export const pt = (gross: number) => (gross <= 15000 ? 0 : gross <= 20000 ? 150 : 200)

const GROSS = [120000, 38000, 85000, 52000, 60000, 72000, 48000, 42000, 30000, 30000, 55000, 40000]
const LINES = EMPLOYEES.map((e, i) => {
  const gross = GROSS[i]
  const unpaid = e.id === 'e9' ? 1 : 0
  const lop = Math.round((gross / 31) * unpaid)
  const ptax = pt(gross)
  return { e, gross, unpaid, lop, pt: ptax, net: gross - lop - ptax, prev: gross - ptax }
})

export default function Payroll() {
  const { toast } = useStore()
  const [step, setStep] = useState(3)
  const [confirm, setConfirm] = useState(false)
  const tot = LINES.reduce((a, l) => ({ gross: a.gross + l.gross, ded: a.ded + l.pt + l.lop, net: a.net + l.net }), { gross: 0, ded: 0, net: 0 })
  const locked = step >= 5

  return (
    <>
      <PageHeader eyebrow="Super Admin · confidential" title="Payroll · October 2026" sample="P2" subtitle="Attendance cutoff 25 Oct · Rules: PT-TS v2026.1 · PF inactive · TDS inactive"
        actions={locked
          ? <Pill tone="green"><Lock size={13} /> Approved & locked</Pill>
          : <><button className="btn-outline" onClick={() => toast({ tone: 'success', title: 'Recalculated', body: 'Snapshot hash 7f3a…c21e' })}><Calculator size={16} /> Recalculate</button>
            <button className="btn-primary" onClick={() => setConfirm(true)}><Check size={17} /> Approve run</button></>} />

      <Card className="p-5 mb-6">
        <ol className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1 shrink-0">
              <div className={clsx('flex items-center gap-2 h-9 px-3 rounded-full text-[12.5px] font-semibold',
                i < step ? 'bg-emerald-50 text-emerald-700' : i === step ? 'bg-brand-600 text-white shadow-glow' : 'bg-ink-50 text-ink-400')}>
                <span className={clsx('size-5 rounded-full grid place-items-center text-[11px]', i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-white/20' : 'bg-ink-200 text-white')}>{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                {s}
              </div>
              {i < STEPS.length - 1 && <span className={clsx('w-5 h-0.5 rounded', i < step ? 'bg-emerald-300' : 'bg-ink-100')} />}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total gross" value={inr(tot.gross)} icon={Calculator} />
        <StatTile label="Deductions" value={inr(tot.ded)} icon={Calculator} tone="amber" hint="PT + 1 day LOP" />
        <StatTile label="Net payable" value={inr(tot.net)} icon={Calculator} tone="green" />
        <StatTile label="Exceptions" value="2" icon={AlertTriangle} tone="red" hint="Review before approving" />
      </div>

      <Card>
        <CardHeader title="Salary register" subtitle="Draft snapshot · compared with last approved month" action={<Pill tone="violet"><ShieldCheck size={13} /> HR has no access to this page</Pill>} />
        <div className="px-3 pb-3 overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead><tr>{['Employee', 'Gross', 'Unpaid days', 'LOP', 'PT', 'Net pay', 'vs Sep'].map((h) => <th key={h} className={clsx('table-th', h !== 'Employee' && 'text-right')}>{h}</th>)}</tr></thead>
            <tbody>
              {LINES.map((l) => {
                const diff = l.net - l.prev
                return (
                  <tr key={l.e.id} className="hover:bg-ink-50/50">
                    <td className="table-td"><div className="flex items-center gap-3"><Avatar name={l.e.name} hue={l.e.hue} size={30} /><div><div className="font-semibold text-ink-900 text-[13.5px]">{l.e.name}</div><div className="text-[12px] text-ink-400">{l.e.code}</div></div></div></td>
                    <td className="table-td text-right tabular-nums">{inr(l.gross)}</td>
                    <td className="table-td text-right tabular-nums">{l.unpaid || '—'}</td>
                    <td className="table-td text-right tabular-nums">{l.lop ? inr(l.lop) : '—'}</td>
                    <td className="table-td text-right tabular-nums">{inr(l.pt)}</td>
                    <td className="table-td text-right tabular-nums font-semibold text-ink-900">{inr(l.net)}</td>
                    <td className={clsx('table-td text-right tabular-nums text-[12.5px]', diff < 0 ? 'text-rose-600' : 'text-ink-400')}>{diff ? inr(diff) : 'No change'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Approve October payroll?"
        footer={<><button className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="btn-primary" onClick={() => { setStep(5); setConfirm(false); toast({ tone: 'success', title: 'Payroll approved & locked', body: 'Payslips queued — each employee gets only their own.' }) }}>Approve & lock</button></>}>
        <div className="space-y-3 text-[13.5px] text-ink-600">
          <p>Net payable <b className="text-ink-900">{inr(tot.net)}</b> for {LINES.length} employees.</p>
          <p className="rounded-xl bg-amber-50 text-amber-800 p-3 text-[13px]">After approval, rows cannot be edited. Corrections go through a supplementary adjustment run.</p>
        </div>
      </Modal>
    </>
  )
}
