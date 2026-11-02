import clsx from 'clsx'
import { AlertTriangle, Calculator, Check, Eye, Lock, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, Drawer, EmptyState, Modal, PageHeader, Pill, StatTile, type Tone } from '../../components/ui'
import { api, type PayrollRunDTO, type PayslipDTO } from '../../lib/api'
import { fmtDate, inr2, istToday, monthName } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { PayslipDoc } from '../Payslips'

const STATUS: Record<PayrollRunDTO['status'], { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft · editable', tone: 'amber' }, APPROVED: { label: 'Approved & locked', tone: 'green' }, PAID: { label: 'Paid', tone: 'violet' },
}
const FLAG: Record<string, string> = {
  NEGATIVE_NET: 'Net pay below zero', UNPAID_EXCEEDS_DAYS: 'Unpaid days exceed days employed',
  PF_RULES_MISSING: 'PF is on in policy but has no reviewed rules; not deducted', TDS_RULES_MISSING: 'TDS is on in policy but has no reviewed rules; not deducted',
}

export default function Payroll() {
  const { toast } = useStore()
  const runs = useApi(() => api.payrollRuns(), [])
  const [sel, setSel] = useState<string | null>(null)
  const [run, setRun] = useState<PayrollRunDTO | null>(null)
  const [period, setPeriod] = useState(() => { const d = new Date(istToday()); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<PayslipDTO | null>(null)
  const [view, setView] = useState<PayslipDTO | null>(null)
  const [confirm, setConfirm] = useState(false)
  const id = sel ?? runs.data?.runs[0]?.id ?? null
  useEffect(() => { if (id) api.payrollRun(id).then(setRun).catch(() => setRun(null)); else setRun(null) }, [id])

  const act = async (fn: () => Promise<PayrollRunDTO>, title: string) => {
    setBusy(true)
    try { const r = await fn(); setRun(r); setSel(r.id); runs.reload(); toast({ tone: 'success', title }) }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t do that', body: errMsg(e) }) } finally { setBusy(false); setConfirm(false) }
  }
  const calc = () => { const [y, m] = period.split('-').map(Number); act(() => api.calculatePayroll(y, m), `${monthName(y, m)} calculated`) }
  const blocking = run?.payslips?.some((s) => s.flags?.includes('NEGATIVE_NET'))

  return (
    <>
      <PageHeader eyebrow="Console · Super Admin only" title="Payroll" subtitle="Calculate the month, review each payslip, then approve. Approved months are locked and payslips go to employees."
        actions={
          <div className="flex items-center gap-2">
            <input type="month" className="input w-44" value={period} max={istToday().slice(0, 7)} onChange={(e) => setPeriod(e.target.value)} aria-label="Month" />
            <button className="btn-brand h-10 px-4 rounded-xl" disabled={busy || !period} onClick={calc}><Calculator size={16} /> Calculate</button>
          </div>
        } />

      <div className="grid xl:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
        <Card className="p-2">
          {runs.data?.runs.length === 0 && <p className="p-4 text-[13px] text-ink-400">No months yet. Pick a month and press Calculate.</p>}
          {runs.data?.runs.map((r) => (
            <button key={r.id} onClick={() => setSel(r.id)} className={clsx('w-full rounded-xl px-4 py-3 text-left transition', r.id === id ? 'bg-brand-50' : 'hover:bg-ink-50')}>
              <div className="font-semibold text-ink-900">{monthName(r.year, r.month)}</div>
              <Pill tone={STATUS[r.status].tone} className="mt-1">{STATUS[r.status].label}</Pill>
            </button>
          ))}
        </Card>

        {!run ? <Card><EmptyState icon={Wallet} title="No payroll month selected" body="Set salaries in Employee Directory first, then calculate a month." /></Card> : (
          <div className="space-y-5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-bold text-ink-900">{monthName(run.year, run.month)}</h2>
                <div className="text-[12.5px] text-ink-500">Calculated {fmtDate(run.calculated_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{run.approved_at && ` · approved ${fmtDate(run.approved_at)}`}</div>
              </div>
              <div className="flex gap-2">
                {run.status === 'DRAFT' && <button className="btn-outline" disabled={busy} onClick={() => act(() => api.calculatePayroll(run.year, run.month), 'Recalculated')}><Calculator size={15} /> Recalculate</button>}
                {run.status === 'DRAFT' && <button className="btn-primary" disabled={busy || blocking} onClick={() => setConfirm(true)}><Lock size={15} /> Approve & lock</button>}
                {run.status === 'APPROVED' && <button className="btn-primary" disabled={busy} onClick={() => act(() => api.payrollAction(run.id, 'paid'), 'Payment recorded')}><Check size={15} /> Mark as paid</button>}
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              <StatTile label="Payslips" value={run.totals?.count ?? 0} icon={Wallet} />
              <StatTile label="Gross" value={inr2(run.totals?.gross ?? 0)} icon={Calculator} tone="blue" />
              <StatTile label="Deductions" value={inr2(run.totals?.deductions ?? 0)} icon={Calculator} tone="amber" />
              <StatTile label="Net payable" value={inr2(run.totals?.net ?? 0)} icon={Check} tone="green" />
            </div>

            {run.warnings.length > 0 && (
              <Card className="p-4 ring-1 ring-amber-200 bg-amber-50/60">
                <div className="flex items-center gap-2 font-semibold text-amber-800 mb-1"><AlertTriangle size={16} /> Left out of this run</div>
                <ul className="text-[13px] text-amber-800">{run.warnings.map((w, i) => <li key={i}>{w.employee}: {w.message}</li>)}</ul>
              </Card>
            )}

            <Card className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead><tr className="text-left text-ink-500 text-[12px] border-b border-ink-100">
                  <th className="px-4 py-3 font-medium">Employee</th><th className="px-3 font-medium">Paid days</th><th className="px-3 font-medium">Leave / shortfall</th>
                  <th className="px-3 font-medium text-right">Gross</th><th className="px-3 font-medium text-right">Deductions</th><th className="px-3 font-medium text-right">Net</th><th className="px-3" />
                </tr></thead>
                <tbody>
                  {run.payslips?.map((s) => {
                    const lv = Object.entries(s.data.info.leave_days)
                    return (
                      <tr key={s.id} className="border-b border-ink-50 last:border-0 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink-900">{s.data.employee.name}</div>
                          <div className="text-[12px] text-ink-500">{s.data.employee.designation}</div>
                          {s.flags?.map((f) => <div key={f} className={clsx('text-[11.5px] mt-1', f === 'NEGATIVE_NET' ? 'text-rose-700' : 'text-amber-700')}>⚠ {FLAG[f] ?? f}</div>)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">{Number(s.data.paid_days)} / {s.data.period.days}{Number(s.unpaid_days) > 0 && <div className="text-[11.5px] text-rose-600">{Number(s.unpaid_days)} unpaid</div>}</td>
                        <td className="px-3 py-3 text-[12.5px] text-ink-600">{lv.length ? lv.map(([k, v]) => `${k} ${v}`).join(', ') : '—'}{s.data.info.shortfall_days > 0 && <div className="text-amber-700">{s.data.info.shortfall_days} short day(s), not deducted</div>}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{inr2(s.gross)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{inr2(s.deductions)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold">{inr2(s.net)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-right">
                          <button className="size-8 inline-grid place-items-center rounded-lg hover:bg-ink-50 text-ink-500" onClick={() => setView(s)} aria-label="View payslip"><Eye size={15} /></button>
                          {run.status === 'DRAFT' && <button className="size-8 inline-grid place-items-center rounded-lg hover:bg-ink-50 text-ink-500" onClick={() => setEdit(s)} aria-label="Adjust"><Pencil size={15} /></button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
            <p className="text-[12px] text-ink-400">Shortfall and attendance are shown for your review only; nothing is deducted unless you enter unpaid days. PF and TDS stay off until reviewed rules are added.</p>
          </div>
        )}
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Approve and lock this month?"
        footer={<><button className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={() => run && act(() => api.payrollAction(run.id, 'approve'), 'Approved · payslips sent')}><Lock size={15} /> Approve & lock</button></>}>
        <p className="text-[13.5px] text-ink-600">Payslips become visible to employees and each gets an email. After this nothing in the month can change; corrections go into a later month as adjustments.</p>
      </Modal>
      {view && <Drawer open wide onClose={() => setView(null)} title={view.data.employee.name} subtitle={monthName(view.year, view.month)}><PayslipDoc slip={view} /></Drawer>}
      {edit && <Adjust slip={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); if (id) api.payrollRun(id).then(setRun) }} />}
    </>
  )
}

function Adjust({ slip, onClose, onDone }: { slip: PayslipDTO; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const [unpaid, setUnpaid] = useState(String(Number(slip.unpaid_days ?? 0)))
  const [adj, setAdj] = useState(slip.adjustments ?? [])
  const [busy, setBusy] = useState(false)
  const set = (i: number, p: Partial<(typeof adj)[number]>) => setAdj(adj.map((a, j) => (j === i ? { ...a, ...p } : a)))
  const ok = Number(unpaid) >= 0 && Number(unpaid) * 2 === Math.round(Number(unpaid) * 2) && adj.every((a) => a.name.trim() && Number(a.amount) > 0 && a.note.trim().length >= 3)
  const save = async () => {
    setBusy(true)
    try { await api.adjustPayslip(slip.id, { unpaid_days: unpaid, adjustments: adj }); toast({ tone: 'success', title: 'Payslip updated' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <Drawer open onClose={onClose} title={slip.data.employee.name} subtitle="Adjust this payslip"
      footer={<div className="w-full flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!ok || busy} onClick={save}>Save & recalculate</button></div>}>
      <div className="space-y-5 text-[13.5px]">
        <div>
          <label className="label" htmlFor="unpaid">Unpaid days (LOP)</label>
          <input id="unpaid" type="number" min={0} step={0.5} className="input w-32" value={unpaid} onChange={(e) => setUnpaid(e.target.value)} />
          <p className="text-[12px] text-ink-500 mt-1">Earnings are reduced by days in month ÷ paid days. Only enter days you’ve decided are unpaid.</p>
        </div>
        <div>
          <div className="label">One-off additions or deductions</div>
          <div className="space-y-3">
            {adj.map((a, i) => (
              <div key={i} className="rounded-xl ring-1 ring-ink-100 p-3 space-y-2">
                <div className="flex gap-2">
                  <select className="input w-36" value={a.type} onChange={(e) => set(i, { type: e.target.value as 'EARNING' | 'DEDUCTION' })}><option value="EARNING">Addition</option><option value="DEDUCTION">Deduction</option></select>
                  <input className="input" placeholder="Name, e.g. Bonus" value={a.name} onChange={(e) => set(i, { name: e.target.value })} />
                  <input className="input w-32" type="number" min={0} step="0.01" placeholder="₹" value={a.amount} onChange={(e) => set(i, { amount: e.target.value })} />
                  <button className="size-10 grid place-items-center rounded-lg text-ink-400 hover:text-rose-600 shrink-0" onClick={() => setAdj(adj.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={15} /></button>
                </div>
                <input className="input" placeholder="Why (required, shown on the payslip)" value={a.note} onChange={(e) => set(i, { note: e.target.value })} />
              </div>
            ))}
          </div>
          <button className="btn-ghost btn-sm mt-2" onClick={() => setAdj([...adj, { name: '', type: 'EARNING', amount: '', note: '' }])}><Plus size={14} /> Add a line</button>
        </div>
      </div>
    </Drawer>
  )
}
