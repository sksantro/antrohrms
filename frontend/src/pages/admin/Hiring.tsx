import { Check, FileSignature, Star, UserCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Card, CardHeader, PageHeader, Pill } from '../../components/ui'
import { api, type CandidateDTO } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { CandidateDrawer, STAGE } from '../hr/Recruitment'

/** Super Admin: select candidates and approve offers with salary. Approving sends the offer automatically. */
export default function Hiring() {
  const { data, error, reload } = useApi(() => api.hiring(), [])
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <PageHeader eyebrow="Console" title="Hiring decisions" subtitle="Select candidates after their interviews, then add salary and approve offers. Approved offers are emailed to the candidate at once." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader icon={UserCheck} title="Selection" subtitle="Scorecards are in" />
          {data && data.selection.length === 0 && <p className="px-5 pb-6 text-[13.5px] text-ink-400">No one waiting for a decision.</p>}
          <ul className="divide-y divide-ink-100">{data?.selection.map((c) => <Row key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}</ul>
        </Card>
        <Card>
          <CardHeader icon={FileSignature} title="Offers to approve" subtitle="HR's draft, without salary" />
          {data && data.offers.length === 0 && <p className="px-5 pb-6 text-[13.5px] text-ink-400">No offers waiting.</p>}
          <ul className="divide-y divide-ink-100">{data?.offers.map((c) => <Row key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}</ul>
        </Card>
      </div>
      {open && <CandidateDrawer id={open} onClose={() => { setOpen(null); reload() }} adminActions={(c, r) => <AdminPanel c={c} reload={() => { r(); reload() }} />} />}
    </>
  )
}

function Row({ c, onOpen }: { c: CandidateDTO; onOpen: () => void }) {
  return (
    <li><button className="w-full px-5 py-4 flex flex-wrap items-center gap-3 text-left hover:bg-ink-50/60" onClick={onOpen}>
      <Avatar name={c.name} size={38} />
      <div className="min-w-0 flex-1"><div className="font-semibold text-ink-900">{c.name}</div>
        <div className="text-[12.5px] text-ink-500">{c.offer?.status === 'PENDING_ADMIN' ? `${c.offer.designation} · joining ${fmtDate(c.offer.joining_date, { day: 'numeric', month: 'short' })}` : `${c.role_applied} · ${c.feedback?.length ?? 0} scorecard(s)`}</div></div>
      {c.avg_score != null && <Pill tone="violet"><Star size={12} /> {c.avg_score}</Pill>}
      <Pill tone={STAGE[c.stage].tone}>{STAGE[c.stage].label}</Pill>
    </button></li>
  )
}

function AdminPanel({ c, reload }: { c: CandidateDTO; reload: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [gross, setGross] = useState(c.offer?.monthly_gross ?? '')
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); setNote(''); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const o = c.offer
  if (['INTERVIEWING', 'SELECTION_PENDING'].includes(c.stage) && c.feedback?.length) return (
    <div className="rounded-2xl ring-1 ring-brand-200 bg-brand-50/40 p-4 space-y-3">
      <div className="font-semibold text-ink-900">Your decision</div>
      <input className="input" placeholder="Note (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button className="btn-outline btn-sm" disabled={busy || note.trim().length < 3} onClick={() => run(() => api.decideCandidate(c.id, 'REJECT', note), 'Marked not selected')}><X size={14} /> Not selected</button>
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.decideCandidate(c.id, 'SELECT', note), 'Selected. HR drafts the offer next.')}><Check size={14} /> Select</button>
      </div>
    </div>
  )
  if (o?.status === 'PENDING_ADMIN') return (
    <div className="rounded-2xl ring-1 ring-brand-200 bg-brand-50/40 p-4 space-y-3">
      <div className="font-semibold text-ink-900">Approve the offer</div>
      <label className="block text-[13px]">Monthly gross salary (₹)<input type="number" min={1} className="input mt-1 sm:w-60" value={gross} onChange={(e) => setGross(e.target.value)} /></label>
      <input className="input" placeholder="Note (required to send back)" value={note} onChange={(e) => setNote(e.target.value)} />
      <p className="text-[12px] text-ink-500">Approving freezes the letter with the salary and emails the candidate a personal link straight away. HR never sees the salary.</p>
      <div className="flex justify-end gap-2">
        <button className="btn-outline btn-sm" disabled={busy || note.trim().length < 3} onClick={() => run(() => api.decideOffer(o.id, 'NEEDS_CHANGES', note), 'Sent back to HR')}>Send back</button>
        <button className="btn-primary btn-sm" disabled={busy || !(Number(gross) > 0)} onClick={() => { if (window.confirm(`Approve and email the offer at ₹${Number(gross).toLocaleString('en-IN')} a month?`)) run(() => api.decideOffer(o.id, 'APPROVE', note, String(gross)), 'Offer approved and sent') }}><Check size={14} /> Approve and send</button>
      </div>
    </div>
  )
  return null
}
