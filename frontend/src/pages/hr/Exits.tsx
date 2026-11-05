import { CheckCircle2, Circle, DoorOpen, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Pill } from '../../components/ui'
import { api, type ExitDTO } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fmtDate } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { step } from '../Assets'
import { RESIGN } from '../Resignation'
import { LETTER } from './Letters'

const KIND: Record<string, string> = { RESIGNATION_ACCEPTANCE: 'Resignation acceptance', FNF_STATEMENT: 'F&F statement', EXPERIENCE: 'Experience letter', RELIEVING: 'Relieving letter' }

/** HR: track resignations and run the exit checklist. Amounts are never shown here. */
export default function Exits() {
  const { data, error, reload } = useApi(() => api.exits(), [])
  return (
    <>
      <PageHeader eyebrow="HR operations" title="Exit checklist" subtitle="Handover, asset return and letters. The Super Admin accepts resignations and approves the full & final." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      {!!data?.resignations.length && <Card className="mb-6"><CardHeader icon={LogOut} title="Resignations waiting for the Super Admin" />
        <ul className="divide-y divide-ink-100">{data.resignations.map((r) => (
          <li key={r.id} className="px-5 py-3 flex items-center gap-3"><Avatar name={r.employee.display_name} size={32} /><div className="flex-1"><div className="font-semibold text-ink-900">{r.employee.display_name}</div><div className="text-[12px] text-ink-500">Proposed last day {fmtDate(r.proposed_last_day, { day: 'numeric', month: 'short' })}</div></div><Pill tone={RESIGN[r.status].tone}>{RESIGN[r.status].label}</Pill></li>
        ))}</ul></Card>}
      <div className="space-y-4">
        {data && data.exits.length === 0 && <Card><EmptyState icon={DoorOpen} title="No exits in progress" /></Card>}
        {data?.exits.map((x) => <ExitCard key={x.id} x={x} onChange={reload} />)}
      </div>
    </>
  )
}

export function ExitCard({ x, onChange, children }: { x: ExitDTO; onChange: () => void; children?: React.ReactNode }) {
  const { toast } = useStore()
  const { hasRole } = useAuth()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); onChange() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const done = x.status === 'COMPLETED'
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4"><Avatar name={x.employee.display_name} size={40} />
        <div className="flex-1"><div className="font-bold text-ink-900">{x.employee.display_name}</div><div className="text-[12.5px] text-ink-500">{x.employee.designation} · last day {fmtDate(x.last_working_day, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
        <Pill tone={done ? 'gray' : x.blockers.length ? 'amber' : 'green'} dot>{done ? 'Exited' : x.blockers.length ? `${x.blockers.length} open` : 'Cleared'}</Pill>
        <Pill tone={x.fnf_status === 'APPROVED' ? 'green' : 'amber'}>F&F {x.fnf_status === 'APPROVED' ? 'approved' : 'pending'}</Pill></div>
      <div className="grid lg:grid-cols-3 gap-5 text-[13px]">
        <div><div className="text-[12px] font-semibold uppercase tracking-wide text-ink-400 mb-2">Checklist</div>
          {x.checklist.map((i) => <button key={i.key} disabled={busy || done} onClick={() => run(() => api.exitCheck(x.id, i.key, !i.done), i.done ? 'Unticked' : 'Done')} className="w-full flex items-center gap-2 py-1 text-left">
            {i.done ? <CheckCircle2 size={17} className="text-emerald-600" /> : <Circle size={17} className="text-ink-300" />}<span className={i.done ? 'line-through text-ink-500' : ''}>{i.label}</span></button>)}</div>
        <div><div className="text-[12px] font-semibold uppercase tracking-wide text-ink-400 mb-2">Company assets</div>
          {x.assets.length === 0 ? <div className="text-emerald-700">All returned</div> : x.assets.map((a) => <div key={a.id} className="py-1">{a.asset.tag} · <span className="text-ink-500">{step(a)}</span></div>)}
          {x.assets.length > 0 && <Link to="/hr/assets" className="text-brand-600 underline text-[12.5px]">Open asset register</Link>}</div>
        <div><div className="text-[12px] font-semibold uppercase tracking-wide text-ink-400 mb-2">Letters</div>
          {x.letters.map((l) => <div key={l.id} className="flex items-center gap-2 py-1">{KIND[l.kind] ?? l.kind}<Pill tone={LETTER[l.status].tone}>{LETTER[l.status].label}</Pill></div>)}
          <Link to="/hr/letters" className="text-brand-600 underline text-[12.5px]">Open letter drafts</Link></div>
      </div>
      {children}
      {!done && <div className="flex flex-wrap items-center justify-end gap-3 mt-4 border-t border-ink-100 pt-4">
        <span className="text-[12px] text-ink-500 flex-1">{!x.can_complete ? 'Access can be revoked on or after the last working day.' : x.blockers.length ? `Still open: ${x.blockers.join(', ')}` : 'Completing ends their login and marks them exited.'}</span>
        {(hasRole('HR_OPERATIONS') || hasRole('SUPER_ADMIN')) && <button className="btn-primary btn-sm" disabled={busy || !x.can_complete} onClick={() => { if (window.confirm(`Complete ${x.employee.display_name}'s exit? Their login stops working now.`)) run(() => api.completeExit(x.id), 'Exit completed') }}>Complete exit</button>}
      </div>}
    </Card>
  )
}
