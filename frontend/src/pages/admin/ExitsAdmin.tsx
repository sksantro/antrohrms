import { Check, Laptop, LogOut, Plus, Trash2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, Card, CardHeader, PageHeader, Pill } from '../../components/ui'
import { api, type ExitDTO, type ResignationDTO, type SettlementLine } from '../../lib/api'
import { fmtDate, inr2 } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { ExitCard } from '../hr/Exits'

/** Super Admin: resignation decisions, asset disputes, and full & final settlement. */
export default function ExitsAdmin() {
  const { data, error, reload } = useApi(() => api.exits(), [])
  const disputes = useApi(() => api.assetDisputes(), [])
  return (
    <>
      <PageHeader eyebrow="Console" title="Exits & assets" subtitle="Accept resignations, settle asset disputes and approve the full & final. Nothing is deducted automatically." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <div className="grid xl:grid-cols-2 gap-6 mb-6 items-start">
        <Card><CardHeader icon={LogOut} title="Resignations" />
          {data && data.resignations.filter((r) => r.status === 'SUBMITTED').length === 0 && <p className="px-5 pb-5 text-[13.5px] text-ink-400">None waiting.</p>}
          <div className="space-y-4 px-5 pb-5">{data?.resignations.filter((r) => r.status === 'SUBMITTED').map((r) => <ResignationRow key={r.id} r={r} onDone={reload} />)}</div></Card>
        <Card><CardHeader icon={Laptop} title="Asset disputes" />
          {disputes.data && disputes.data.disputes.length === 0 && <p className="px-5 pb-5 text-[13.5px] text-ink-400">None.</p>}
          <ul className="divide-y divide-ink-100">{disputes.data?.disputes.map((a) => <Dispute key={a.id} id={a.id} title={`${a.asset.tag} · ${a.employee.display_name}`}
            body={`HR: ${a.condition.toLowerCase()}${a.return_note ? ` (“${a.return_note}”)` : ''} · employee ${a.emp_agrees ? 'agrees' : `disagrees: “${a.emp_note}”`}`} onDone={() => { disputes.reload(); reload() }} />)}</ul></Card>
      </div>
      <div className="space-y-4">{data?.exits.map((x) => <ExitCard key={x.id} x={x} onChange={reload}>{x.status !== 'COMPLETED' && <Settlement x={x} onDone={reload} />}</ExitCard>)}</div>
    </>
  )
}

function ResignationRow({ r, onDone }: { r: ResignationDTO; onDone: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [last, setLast] = useState(r.proposed_last_day)
  const [busy, setBusy] = useState(false)
  const go = async (d: 'ACCEPT' | 'DISCUSSION' | 'NOTICE_REVISION') => {
    setBusy(true)
    try { await api.decideResignation(r.id, d, note, last); toast({ tone: 'success', title: d === 'ACCEPT' ? 'Accepted; exit started' : 'Sent to the employee' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <div className="rounded-2xl ring-1 ring-ink-100 p-4 space-y-3">
      <div className="flex items-center gap-2"><Avatar name={r.employee.display_name} size={30} /><span className="font-semibold text-ink-900">{r.employee.display_name}</span>{r.short_notice && <Pill tone="amber">Short notice</Pill>}{r.revision > 1 && <Pill>Rev {r.revision}</Pill>}</div>
      <pre className="whitespace-pre-wrap font-sans text-[12.5px] text-ink-700 bg-ink-50 rounded-xl p-3 max-h-48 overflow-auto">{r.letter}</pre>
      <div className="flex flex-wrap gap-2 items-center text-[13px]">
        <label className="flex items-center gap-2">Last day<input type="date" className="input h-9 w-40" value={last} onChange={(e) => setLast(e.target.value)} /></label>
        <input className="input h-9 flex-1 min-w-48" placeholder="Note (required for short notice or to send back)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-ghost btn-sm" disabled={busy || note.trim().length < 3} onClick={() => go('DISCUSSION')}>Ask to discuss</button>
        <button className="btn-outline btn-sm" disabled={busy || note.trim().length < 3} onClick={() => go('NOTICE_REVISION')}>Ask to change date</button>
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => go('ACCEPT')}><Check size={14} /> Accept</button>
      </div>
    </div>
  )
}

function Dispute({ id, title, body, onDone }: { id: string; title: string; body: string; onDone: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const go = async (d: 'ACCEPT' | 'WRITE_OFF' | 'RECOVERY_REVIEW') => {
    try { await api.resolveAllocation(id, d, note); toast({ tone: 'success', title: 'Decided' }); onDone() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) }
  }
  return (
    <li className="px-5 py-4 space-y-2"><div className="font-semibold text-ink-900">{title}</div><div className="text-[12.5px] text-ink-500">{body}</div>
      <input className="input h-9" placeholder="Decision note (required)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-ghost btn-sm" disabled={note.trim().length < 3} onClick={() => go('RECOVERY_REVIEW')}>Flag for recovery review</button>
        <button className="btn-outline btn-sm" disabled={note.trim().length < 3} onClick={() => go('WRITE_OFF')}>Write off</button>
        <button className="btn-primary btn-sm" disabled={note.trim().length < 3} onClick={() => go('ACCEPT')}>Accept as is</button>
      </div></li>
  )
}

function Settlement({ x, onDone }: { x: ExitDTO; onDone: () => void }) {
  const { toast } = useStore()
  const [st, setSt] = useState(x.settlement)
  const [lines, setLines] = useState<SettlementLine[]>(x.settlement?.lines ?? [])
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!x.settlement) api.settlement(x.id).then((r) => { setSt(r.settlement); setLines(r.settlement?.lines ?? []) }).catch(() => undefined) }, [x])
  const locked = st?.status === 'APPROVED'
  const net = lines.reduce((s, l) => s + (Number(l.amount) || 0) * (l.type === 'EARNING' ? 1 : -1), 0)
  const upd = (i: number, p: Partial<SettlementLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const run = async (fn: () => Promise<ExitDTO>, title: string) => {
    setBusy(true)
    try { const r = await fn(); setSt(r.settlement); setLines(r.settlement?.lines ?? []); toast({ tone: 'success', title }); onDone() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  if (!st) return null
  return (
    <div className="mt-5 rounded-2xl ring-1 ring-brand-200 bg-brand-50/30 p-4 space-y-3 text-[13px]">
      <div className="flex items-center gap-2 font-bold text-ink-900"><Wallet size={16} /> Full & final {locked && <Pill tone="green">Approved {st.approved_at && fmtDate(st.approved_at, { day: 'numeric', month: 'short' })}</Pill>}</div>
      <div className="text-[12px] text-ink-500">Salary on record: {st.info.monthly_gross ? inr2(Number(st.info.monthly_gross)) : '—'} / month · final month {st.info.paid_days}/{st.info.month_days} days · {st.info.el_available} EL days left</div>
      {st.info.warnings.map((w) => <div key={w} className="rounded-lg bg-amber-50 text-amber-800 px-3 py-2">{w}</div>)}
      <div className="space-y-2">{lines.map((l, i) => (
        <div key={i} className="grid sm:grid-cols-[minmax(0,1fr)_120px_130px_minmax(0,1fr)_32px] gap-2 items-center">
          <input className="input h-9" disabled={locked || l.system} value={l.name} onChange={(e) => upd(i, { name: e.target.value })} aria-label="Line" />
          <select className="input h-9" disabled={locked || l.system} value={l.type} onChange={(e) => upd(i, { type: e.target.value as SettlementLine['type'] })} aria-label="Type"><option value="EARNING">Pay</option><option value="DEDUCTION">Deduct</option></select>
          <input className="input h-9 text-right" type="number" min={0} disabled={locked} value={l.amount} onChange={(e) => upd(i, { amount: e.target.value })} aria-label="Amount" />
          <input className="input h-9" disabled={locked} placeholder={l.system ? 'Note' : 'Note (required)'} value={l.note} onChange={(e) => upd(i, { note: e.target.value })} aria-label="Note" />
          {!locked && !l.system ? <button className="btn-ghost btn-sm !px-1" aria-label="Remove" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button> : <span />}
        </div>
      ))}</div>
      <div className="flex flex-wrap items-center gap-2">
        {!locked && <button className="btn-ghost btn-sm" onClick={() => setLines([...lines, { name: '', type: 'EARNING', amount: '0', note: '' }])}><Plus size={14} /> Add line</button>}
        <span className="flex-1 text-right font-bold text-ink-900">Net payable {inr2(net)}</span>
        {!locked && <>
          <button className="btn-outline btn-sm" disabled={busy} onClick={() => run(() => api.saveSettlement(x.id, lines), 'Saved')}>Save</button>
          <button className="btn-primary btn-sm" disabled={busy || net < 0} onClick={() => { if (window.confirm(`Approve the full & final of ${inr2(net)}? The statement is sent to the employee.`)) run(async () => { await api.saveSettlement(x.id, lines); return api.approveSettlement(x.id) }, 'Approved; statement sent') }}><Check size={14} /> Approve</button>
        </>}
      </div>
    </div>
  )
}
