import { Laptop, PackageCheck, Plus, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Card, CardHeader, Drawer, EmptyState, PageHeader, Pill, type Tone } from '../components/ui'
import { api, type AllocationDTO, type AssetDTO, type AssetState } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fmtDate } from '../lib/format'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'

export const ASSET: Record<AssetState, { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Available', tone: 'green' }, ASSIGNED: { label: 'Assigned', tone: 'blue' }, RETURN_PENDING: { label: 'Return pending', tone: 'amber' },
  RETURNED: { label: 'Returned: needs decision', tone: 'red' }, WRITTEN_OFF: { label: 'Written off', tone: 'gray' },
}
const d = (iso: string | null) => (iso ? fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/** What the employee must do next on one hand-over. */
export function step(a: AllocationDTO): string {
  if (a.closed_at) return a.admin_decision ? `Closed by Super Admin: ${a.admin_decision.toLowerCase().replace('_', ' ')}` : `Returned ${d(a.closed_at)}`
  if (a.disputed) return 'Waiting for the Super Admin'
  if (a.hr_ack_at && !a.emp_ack_at) return `HR recorded the return as ${a.condition.toLowerCase()}: confirm`
  if (a.return_started_at) return 'Return started: hand it to HR'
  if (!a.ack_at) return 'Waiting for acknowledgement'
  return `Acknowledged ${d(a.ack_at)}`
}

export function MyAssets() {
  const { toast } = useStore()
  const { data, error, reload } = useApi(() => api.myAssets(), [])
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [note, setNote] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const rows = data?.allocations ?? []
  return (
    <>
      <PageHeader eyebrow="My workspace" title="My assets" subtitle="Company equipment in your care. Acknowledge what you receive and confirm returns." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <Card>
        <CardHeader icon={Laptop} title="Company assets" />
        {data && rows.length === 0 && <EmptyState icon={Laptop} title="No company assets" body="Anything HR hands you appears here." />}
        <ul className="divide-y divide-ink-100">{rows.map((a) => (
          <li key={a.id} className="px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Laptop size={18} /></span>
              <div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{a.asset.make_model} <span className="font-mono text-[12px] text-ink-500">{a.asset.tag}</span></div>
                <div className="text-[12.5px] text-ink-500">{a.asset.category_name} · given {d(a.assigned_at)}{a.assign_note ? ` · “${a.assign_note}”` : ''}</div></div>
              <Pill tone={a.closed_at ? 'gray' : a.disputed ? 'red' : !a.ack_at || (a.hr_ack_at && !a.emp_ack_at) ? 'amber' : 'green'}>{step(a)}</Pill>
            </div>
            {!a.ack_at && !a.return_started_at && !a.closed_at && (
              <div className="flex flex-wrap gap-2 items-center">
                <input className="input h-9 w-44 font-mono" placeholder={`Type ${a.asset.tag}`} value={typed[a.id] ?? ''} onChange={(e) => setTyped({ ...typed, [a.id]: e.target.value })} aria-label="Asset tag" />
                <input className="input h-9 flex-1 min-w-40" placeholder="Note (optional), e.g. charger included" value={note[a.id] ?? ''} onChange={(e) => setNote({ ...note, [a.id]: e.target.value })} />
                <button className="btn-primary btn-sm" disabled={busy || (typed[a.id] ?? '').trim().toLowerCase() !== a.asset.tag.toLowerCase()} onClick={() => run(() => api.myAllocation(a.id, 'acknowledge', { typed: typed[a.id], note: note[a.id] }), 'Acknowledged')}><PackageCheck size={14} /> I received it</button>
              </div>
            )}
            {a.hr_ack_at && !a.emp_ack_at && (
              <div className="rounded-xl bg-ink-50 p-3 space-y-2 text-[13px]">
                <div>HR recorded: <b>{a.condition.toLowerCase()}</b>{a.return_note ? ` · “${a.return_note}”` : ''}</div>
                <input className="input h-9" placeholder="Your note (required if you disagree)" value={note[a.id] ?? ''} onChange={(e) => setNote({ ...note, [a.id]: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button className="btn-outline btn-sm" disabled={busy || (note[a.id] ?? '').trim().length < 5} onClick={() => run(() => api.myAllocation(a.id, 'confirm-return', { agrees: false, note: note[a.id] }), 'Sent to the Super Admin')}>I disagree</button>
                  <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.myAllocation(a.id, 'confirm-return', { agrees: true, note: note[a.id] }), 'Return confirmed')}>I agree</button>
                </div>
              </div>
            )}
          </li>
        ))}</ul>
      </Card>
      {!!data?.personal.length && <Card className="mt-6"><CardHeader icon={Laptop} title="My personal devices (BYOD)" subtitle="Recorded for security only; they're yours, not company assets." />
        <ul className="divide-y divide-ink-100">{data.personal.map((p) => <li key={p.id} className="px-5 py-3 text-[13.5px]">{p.make_model} <span className="font-mono text-[12px] text-ink-500">{p.tag}</span></li>)}</ul></Card>}
    </>
  )
}

export function HrAssets() {
  const { toast } = useStore()
  const { hasRole } = useAuth()
  const admin = hasRole('SUPER_ADMIN')
  const [filter, setFilter] = useState('')
  const { data, error, reload } = useApi(() => api.assets(filter || undefined), [filter])
  const people = useApi(() => api.directory(), [])
  const [adding, setAdding] = useState(false)
  const [assign, setAssign] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const recordReturn = (a: AllocationDTO) => {
    const c = window.prompt('Condition: type GOOD, DAMAGED or MISSING', 'GOOD')?.toUpperCase().trim()
    if (!c) return
    const n = c === 'GOOD' ? '' : window.prompt('Describe the damage or what is missing') ?? ''
    run(() => api.allocationHR(a.id, 'return', { condition: c, note: n }), 'Return recorded; the employee confirms next')
  }
  const rows = data?.assets ?? []
  return (
    <>
      <PageHeader eyebrow="HR operations" title="Asset register" subtitle="Hand out company equipment and take it back. Write-offs and recoveries are decided by the Super Admin."
        actions={<button className="btn-brand h-11 px-5 rounded-xl" onClick={() => setAdding(true)}><Plus size={17} /> Add asset</button>} />
      <div className="flex flex-wrap gap-1.5 mb-4">{[['', 'All'], ['AVAILABLE', 'Available'], ['ASSIGNED,RETURN_PENDING', 'In use'], ['RETURNED', 'Needs decision'], ['WRITTEN_OFF', 'Written off']].map(([v, l]) => (
        <button key={l} onClick={() => setFilter(v)} className={`h-9 px-3.5 rounded-full text-[13px] font-semibold ring-1 ${filter === v ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-ink-200 text-ink-600'}`}>{l}</button>
      ))}</div>
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <Card>
        {data && rows.length === 0 && <EmptyState icon={Laptop} title="No assets here" />}
        <ul className="divide-y divide-ink-100">{rows.map((x: AssetDTO) => (
          <li key={x.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-56"><div className="font-semibold text-ink-900">{x.make_model} <span className="font-mono text-[12px] text-ink-500">{x.tag}</span></div>
              <div className="text-[12.5px] text-ink-500">{x.category_name}{x.serial ? ` · S/N ${x.serial}` : ''}{x.location ? ` · ${x.location}` : ''}{admin && x.cost ? ` · ₹${Number(x.cost).toLocaleString('en-IN')}` : ''}{x.owner ? ` · owned by ${x.owner.display_name}` : ''}</div></div>
            {x.current && <span className="flex items-center gap-2 text-[13px]"><Avatar name={x.current.employee.display_name} size={26} />{x.current.employee.display_name}<span className="text-ink-400">· {step(x.current)}</span></span>}
            {x.category !== 'PERSONAL_DEVICE' && <Pill tone={ASSET[x.state].tone}>{ASSET[x.state].label}</Pill>}
            {x.state === 'AVAILABLE' && x.category !== 'PERSONAL_DEVICE' && <span className="flex gap-2">
              <select className="input h-9 w-48" value={assign[x.id] ?? ''} onChange={(e) => setAssign({ ...assign, [x.id]: e.target.value })} aria-label="Assign to"><option value="">Assign to…</option>{people.data?.people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select>
              <button className="btn-primary btn-sm" disabled={busy || !assign[x.id]} onClick={() => run(() => api.assignAsset(x.id, assign[x.id], ''), 'Assigned; waiting for acknowledgement')}>Assign</button></span>}
            {x.current && !x.current.return_started_at && <button className="btn-outline btn-sm" disabled={busy} onClick={() => run(() => api.allocationHR(x.current!.id, 'return-start'), 'Return started')}><Undo2 size={14} /> Start return</button>}
            {x.current?.return_started_at && !x.current.hr_ack_at && <button className="btn-primary btn-sm" disabled={busy} onClick={() => recordReturn(x.current!)}>Record return</button>}
            {admin && x.state === 'RETURNED' && !x.current && <span className="flex gap-2">
              <button className="btn-outline btn-sm" onClick={() => { const n = window.prompt('Note'); if (n) run(() => api.assetState(x.id, 'AVAILABLE', n), 'Back in service') }}>Back in service</button>
              <button className="btn-ghost btn-sm text-rose-700" onClick={() => { const n = window.prompt('Why write it off?'); if (n) run(() => api.assetState(x.id, 'WRITTEN_OFF', n), 'Written off') }}>Write off</button></span>}
          </li>
        ))}</ul>
      </Card>
      {adding && <AddAsset admin={admin} categories={data?.categories ?? {}} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload() }} />}
    </>
  )
}

function AddAsset({ admin, categories, onClose, onDone }: { admin: boolean; categories: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const people = useApi(() => api.directory(), [])
  const [f, setF] = useState<Record<string, string>>({ category: 'LAPTOP', make_model: '', tag: '', serial: '', purchase_ref: '', location: '', cost: '', owner: '' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setBusy(true); setErr(null)
    try { await api.addAsset(Object.fromEntries(Object.entries(f).filter(([, v]) => v))); onDone() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const byod = f.category === 'PERSONAL_DEVICE'
  return (
    <Drawer open onClose={onClose} title="Add asset" footer={<button className="btn-brand h-10 px-5 rounded-xl" disabled={busy || f.tag.trim().length < 2 || f.make_model.trim().length < 2 || (byod && !f.owner)} onClick={save}>Add</button>}>
      <div className="space-y-3 text-[13px]">
        {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2.5">{err}</div>}
        <label className="block">Category<select className="input mt-1" value={f.category} onChange={set('category')}>{Object.entries(categories).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {byod && <label className="block">Owner<select className="input mt-1" value={f.owner} onChange={set('owner')}><option value="">—</option>{people.data?.people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>}
        <label className="block">Make and model<input className="input mt-1" value={f.make_model} onChange={set('make_model')} /></label>
        <div className="grid grid-cols-2 gap-3"><label>Asset tag<input className="input mt-1 font-mono" value={f.tag} onChange={set('tag')} /></label><label>Serial number<input className="input mt-1" value={f.serial} onChange={set('serial')} /></label></div>
        <div className="grid grid-cols-2 gap-3"><label>Purchase reference<input className="input mt-1" value={f.purchase_ref} onChange={set('purchase_ref')} /></label><label>Location<input className="input mt-1" value={f.location} onChange={set('location')} /></label></div>
        {admin && <label className="block">Cost (₹, Super Admin only)<input type="number" min={0} className="input mt-1" value={f.cost} onChange={set('cost')} /></label>}
      </div>
    </Drawer>
  )
}
